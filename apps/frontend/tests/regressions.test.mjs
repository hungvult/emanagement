import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import axios from "axios";

const require = createRequire(import.meta.url);

test("date inputs reject impossible dates and enforce inclusive bounds", () => {
  const { parseDateInput, isDateWithinBounds } = loadTs("lib/date-input.ts");
  assert.equal(parseDateInput("29/02/2024"), "2024-02-29");
  assert.equal(parseDateInput("29/02/2025"), null);
  assert.equal(parseDateInput("31/02/2026"), null);
  assert.equal(parseDateInput("31/04/2026"), null);
  assert.equal(parseDateInput("1x/10/2026"), null);
  assert.equal(parseDateInput("07-10-2026"), "2026-10-07");
  assert.equal(
    isDateWithinBounds("2026-10-07", "2026-10-07", "2026-10-08"),
    true,
  );
  assert.equal(isDateWithinBounds("2026-10-06", "2026-10-07"), false);
  assert.equal(
    isDateWithinBounds("2026-10-09", undefined, "2026-10-08"),
    false,
  );
});

test("CV service keeps proxy routing and rejects malformed responses", async () => {
  const requests = [];
  let body = { status: "VALID" };
  const { cvService } = loadTs(
    "services/cv.service.ts",
    {},
    {
      "@/lib/api-client": {
        apiClient: {
          post: async (...args) => {
            requests.push(args);
            return body;
          },
        },
      },
    },
  );
  assert.equal((await cvService.validateFrame("frame", true)).status, "VALID");
  assert.equal(requests[0][0], "/cv/validate-frame");
  assert.equal(requests[0][2].baseURL, "/api/v1");
  assert.equal(requests[0][1].check_pose, true);
  body = { status: "SPOOF_DETECTED" };
  assert.equal(
    (await cvService.validateFrame("frame", false)).status,
    "SPOOF_DETECTED",
  );
  for (const malformed of [null, {}, "invalid", { status: 1 }]) {
    body = malformed;
    await assert.rejects(cvService.validateFrame("frame", false));
  }
  body = { status: "ERROR", message: "existing face retained" };
  await assert.rejects(
    cvService.enroll(42, ["frame"]),
    /existing face retained/,
  );
  body = { status: "ENROLLMENT_SUCCESS" };
  await cvService.enroll(42, ["frame"]);
  assert.equal(requests.at(-1)[2].baseURL, "/api/v1");
});
function loadTs(path, globals = {}, modules = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileURLToPath(new URL(`../${path}`, import.meta.url)),
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => modules[name] ?? require(name),
    process,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    queueMicrotask,
    ...globals,
  });
  return exports;
}

function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("indoor face brightness is allowed while genuinely dark frames remain blocked", () => {
  const { ATTENDANCE_BRIGHTNESS_MIN, measureFrameBrightness } = loadTs(
    "lib/camera-utils.ts",
    { process: { env: {} } },
  );
  assert.equal(ATTENDANCE_BRIGHTNESS_MIN, 100);
  for (const [level, blocked] of [
    [40, true],
    [80, true],
    [99, true],
    [100, false],
    [120, false],
    [129, false],
  ]) {
    const pixels = new Uint8ClampedArray(64 * 64 * 4).fill(level);
    const canvas = {
      width: 64,
      height: 64,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({ data: pixels }),
      }),
    };
    const brightness = measureFrameBrightness(
      { videoWidth: 640, videoHeight: 480, readyState: 2 },
      canvas,
    );
    assert.equal(
      brightness < ATTENDANCE_BRIGHTNESS_MIN,
      blocked,
      `brightness=${level}`,
    );
  }
});

test("custom brightness thresholds override the default and invalid values fall back safely", () => {
  for (const [value, expected] of [
    ["130", 130],
    ["80", 80],
    ["-1", 100],
    ["0", 100],
    ["256", 100],
    ["invalid", 100],
  ]) {
    const { ATTENDANCE_BRIGHTNESS_MIN } = loadTs("lib/camera-utils.ts", {
      process: { env: { NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN: value } },
    });
    assert.equal(ATTENDANCE_BRIGHTNESS_MIN, expected);
  }
});
const initialTokens = {
  access_token: "old-access",
  refresh_token: "old-refresh",
};
const response = (config, data) => ({
  config,
  data,
  status: 200,
  statusText: "OK",
  headers: {},
});
function httpError(config, status) {
  return new axios.AxiosError(
    `HTTP ${status}`,
    "ERR_BAD_RESPONSE",
    config,
    null,
    { ...response(config, {}), status },
  );
}
function apiModule(adapter, store = makeStorage(initialTokens), globals = {}) {
  const http = axios.create({ adapter });
  http.create = (config) => axios.create({ ...config, adapter });
  http.isAxiosError = axios.isAxiosError;
  http.CanceledError = axios.CanceledError;
  const redirects = [];
  const api = loadTs(
    "lib/api-client.ts",
    {
      window: {
        localStorage: store,
        location: {
          pathname: "/attendance",
          assign: (url) => redirects.push(url),
        },
      },
      navigator: {},
      ...globals,
    },
    { axios: http },
  ).apiClient;
  return { api, store, redirects };
}

test("a face staying in frame cannot trigger a second attendance scan, even after a minute", () => {
  const { AttendanceScanGate } = loadTs("lib/attendance-scan-gate.ts");
  const gate = new AttendanceScanGate();
  gate.waitForDeparture(0);
  for (let now = 0; now <= 120000; now += 50)
    assert.equal(gate.observe("present", now), false);
  assert.equal(gate.observe("absent", 120050), false);
  assert.equal(gate.observe("absent", 120649), false);
  assert.equal(gate.observe("absent", 120650), true);
  assert.equal(gate.waiting, false);
  gate.waitForDeparture(120700);
  assert.equal(gate.observe("present", 180000), false);
});

test("brief absence and dropped/unknown frames do not unlock attendance", () => {
  const { AttendanceScanGate } = loadTs("lib/attendance-scan-gate.ts");
  const gate = new AttendanceScanGate();
  gate.waitForDeparture(0);
  gate.observe("absent", 4000);
  assert.equal(gate.observe(undefined, 4599), false);
  assert.equal(gate.observe("absent", 4600), false);
  assert.equal(gate.observe("present", 5199), false);
  assert.equal(gate.observe("absent", 5200), false);
  assert.equal(gate.observe("absent", 5800), true);
});

test("attendance keeps the result visible before allowing the next scan", () => {
  const { AttendanceScanGate } = loadTs("lib/attendance-scan-gate.ts");
  const gate = new AttendanceScanGate();
  gate.waitForDeparture(0);
  gate.observe("absent", 100);
  assert.equal(gate.observe("absent", 3499), false);
  assert.equal(gate.observe("absent", 3500), true);
});

test("a camera granted after popup closure is immediately stopped", async () => {
  let grant;
  const permission = new Promise((resolve) => {
    grant = resolve;
  });
  const { AsyncSession, openSessionCamera } = loadTs("lib/async-session.ts", {
    navigator: { mediaDevices: { getUserMedia: () => permission } },
  });
  const session = new AsyncSession();
  let stopped = 0;
  const camera = openSessionCamera(session, { video: true });
  session.cancel();
  grant({
    getTracks: () => [
      {
        stop: () => {
          stopped += 1;
        },
      },
      {
        stop: () => {
          stopped += 1;
        },
      },
    ],
  });
  assert.equal(await camera, null);
  assert.equal(stopped, 2);
});

test("closing/reopening the camera popup cancels delayed work from the previous session", async () => {
  const { AsyncSession } = loadTs("lib/async-session.ts");
  const session = new AsyncSession();
  const revision = session.current;
  let oldCalled = false;
  let newCalled = false;
  session.schedule(() => {
    oldCalled = true;
  }, 1);
  session.cancel();
  session.schedule(() => {
    newCalled = true;
  }, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(session.isCurrent(revision), false);
  assert.equal(oldCalled, false);
  assert.equal(newCalled, true);
});

test("simultaneous 401s share one refresh and retry all requests", async () => {
  let refreshes = 0;
  const { api, store } = apiModule(async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      refreshes += 1;
      assert.equal(config.timeout, 15000);
      return response(config, {
        data: { accessToken: "new-access", refreshToken: "new-refresh" },
      });
    }
    if (config.headers.Authorization === "Bearer old-access")
      throw httpError(config, 401);
    return response(config, { status: "SUCCESS", data: config.url });
  });
  const result = await Promise.all([
    api.get("/records"),
    api.get("/employees"),
    api.get("/alerts"),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(result.length, 3);
  assert.equal(store.getItem("refresh_token"), "new-refresh");
});

test("two tabs with Web Locks rotate the refresh token only once", async () => {
  const store = makeStorage(initialTokens);
  let tail = Promise.resolve();
  const locks = {
    request: (_name, _options, run) => {
      const result = tail.then(run);
      tail = result.catch(() => {});
      return result;
    },
  };
  let refreshes = 0;
  const adapter = async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(config, {
        data: { accessToken: "new-access", refreshToken: "new-refresh" },
      });
    }
    if (config.headers.Authorization === "Bearer old-access")
      throw httpError(config, 401);
    return response(config, { status: "SUCCESS", data: [] });
  };
  const first = apiModule(adapter, store, { navigator: { locks } });
  const second = apiModule(adapter, store, { navigator: { locks } });
  await Promise.all([first.api.get("/records"), second.api.get("/employees")]);
  assert.equal(refreshes, 1);
});

test("a vanished tab's refresh lease expires and another tab takes over", async () => {
  let now = 100000;
  let refreshes = 0;
  const store = makeStorage({
    ...initialTokens,
    refresh_in_progress: String(now),
  });
  const { api } = apiModule(
    async (config) => {
      if (config.url.endsWith("/auth/refresh-token")) {
        refreshes += 1;
        return response(config, { data: { accessToken: "new-access" } });
      }
      if (config.headers.Authorization === "Bearer old-access")
        throw httpError(config, 401);
      return response(config, { status: "SUCCESS" });
    },
    store,
    {
      Date: { now: () => now },
      setTimeout: (fn, delay) => {
        now += delay;
        queueMicrotask(fn);
        return 1;
      },
    },
  );
  await api.get("/records");
  assert.equal(refreshes, 1);
  assert.ok(now >= 120000);
  assert.equal(store.getItem("refresh_in_progress"), null);
});

test("a continuously renewed lease rejects within a bounded wait", async () => {
  let now = 100000;
  const store = makeStorage(initialTokens);
  const getItem = store.getItem;
  store.getItem = (key) =>
    key === "refresh_in_progress" ? String(now) : getItem(key);
  const { api } = apiModule(
    async (config) => {
      throw httpError(config, 401);
    },
    store,
    {
      Date: { now: () => now },
      setTimeout: (fn, delay) => {
        now += delay;
        queueMicrotask(fn);
        return 1;
      },
    },
  );
  await assert.rejects(api.get("/records"), /quá lâu/);
  assert.ok(now <= 140100);
  assert.equal(store.getItem("access_token"), "old-access");
});

test("refresh network/5xx failures preserve the session and allow a later retry", async () => {
  let refreshes = 0;
  const { api, store, redirects } = apiModule(async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      refreshes += 1;
      if (refreshes === 1) throw httpError(config, 503);
      return response(config, { data: { accessToken: "new-access" } });
    }
    if (config.headers.Authorization === "Bearer old-access")
      throw httpError(config, 401);
    return response(config, { status: "SUCCESS" });
  });
  await assert.rejects(api.get("/records"));
  assert.equal(store.getItem("access_token"), "old-access");
  assert.equal(redirects.length, 0);
  await api.get("/records");
  assert.equal(refreshes, 2);
});

test("an expired refresh token clears the session instead of retrying forever", async () => {
  const { api, store, redirects } = apiModule(async (config) => {
    throw httpError(config, 401);
  });
  await assert.rejects(api.get("/records"));
  assert.equal(store.getItem("access_token"), null);
  assert.equal(store.getItem("refresh_token"), null);
  assert.equal(redirects.length, 1);
});

test("refresh cannot restore tokens after logout while HTTP was pending", async () => {
  const store = makeStorage(initialTokens);
  const { api } = apiModule(async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      store.removeItem("access_token");
      store.removeItem("refresh_token");
      return response(config, {
        data: { accessToken: "new-access", refreshToken: "new-refresh" },
      });
    }
    throw httpError(config, 401);
  }, store);
  await assert.rejects(api.get("/records"), /đã thay đổi/);
  assert.equal(store.getItem("access_token"), null);
});

test("an incorrect login does not clear tokens for an existing session", async () => {
  const { api, store, redirects } = apiModule(async (config) => {
    throw httpError(config, 401);
  });
  await assert.rejects(api.post("/auth/login", { password: "wrong" }));
  assert.equal(store.getItem("access_token"), "old-access");
  assert.equal(redirects.length, 0);
});

test("late list responses and unmounted pages cannot update current data", async () => {
  let cleanup;
  const react = {
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      cleanup = fn();
    },
  };
  const { useLatestRequest } = loadTs(
    "hooks/use-latest-request.ts",
    {},
    { react },
  );
  const begin = useLatestRequest();
  let finishOld;
  const oldResponse = new Promise((resolve) => {
    finishOld = resolve;
  });
  const isOldCurrent = begin();
  let displayed;
  const oldRequest = oldResponse.then((data) => {
    if (isOldCurrent()) displayed = data;
  });
  const isNewCurrent = begin();
  if (isNewCurrent()) displayed = "new-filter-results";
  finishOld("old-filter-results");
  await oldRequest;
  assert.equal(displayed, "new-filter-results");
  cleanup();
  assert.equal(isNewCurrent(), false);
});

function authHarness(service) {
  const state = [];
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useState: (value) => {
      const index = state.length;
      state.push(value);
      return [
        value,
        (next) => {
          state[index] = next;
        },
      ];
    },
  };
  const store = makeStorage(initialTokens);
  const routes = [];
  const { AuthProvider } = loadTs(
    "hooks/use-auth.tsx",
    {
      localStorage: store,
      window: { location: { pathname: "/login" } },
    },
    {
      react,
      "react/jsx-runtime": { jsx: (_type, props) => ({ props }) },
      "@/services/auth.service": { authService: service },
      "next/navigation": {
        useRouter: () => ({ push: (url) => routes.push(url) }),
      },
    },
  );
  return {
    auth: AuthProvider({ children: null }).props.value,
    state,
    store,
    routes,
  };
}

test("loading /auth/me failing during login rejects login without revoking tokens", async () => {
  let logouts = 0;
  const { auth, state, store } = authHarness({
    getCurrentUser: async () => {
      throw new Error("Network unavailable");
    },
    logout: async () => {
      logouts += 1;
    },
  });
  await assert.rejects(auth.login("login-access", "login-refresh"), /Network/);
  assert.equal(store.getItem("access_token"), "login-access");
  assert.equal(state[0], null);
  assert.equal(state[1], false);
  assert.match(state[2], /kết nối/);
  assert.equal(logouts, 0);
});

test("a stale /auth/me response cannot sign a user back in after logout", async () => {
  let complete;
  const pending = new Promise((resolve) => {
    complete = resolve;
  });
  const { auth, state, store } = authHarness({
    getCurrentUser: () => pending,
    logout: async () => {},
  });
  const login = auth.login("login-access", "login-refresh");
  await auth.logout();
  complete({ status: "SUCCESS", data: { id: 1, roles: ["ROLE_ADMIN"] } });
  await assert.rejects(login, /đã thay đổi/);
  assert.equal(state[0], null);
  assert.equal(store.getItem("access_token"), null);
});

test("shift time validation correctly validates format, ordering, and duration limits", () => {
  const { getTimeValidationError, parseTimeToSeconds } = loadTs("lib/shifts-helpers.ts");

  // Format and seconds parsing
  assert.equal(parseTimeToSeconds("08:00"), 28800);
  assert.equal(parseTimeToSeconds("08:30:15"), 30615);
  assert.equal(parseTimeToSeconds(""), null);
  assert.equal(parseTimeToSeconds("invalid"), null);
  assert.equal(parseTimeToSeconds("25:00"), null);
  assert.equal(parseTimeToSeconds("-01:00"), null);
  assert.equal(parseTimeToSeconds("08:60"), null);

  // Missing or empty inputs
  assert.equal(
    getTimeValidationError("", "17:00"),
    "Giờ bắt đầu và giờ kết thúc ca không được để trống",
  );
  assert.equal(
    getTimeValidationError("08:00", ""),
    "Giờ bắt đầu và giờ kết thúc ca không được để trống",
  );
  assert.equal(
    getTimeValidationError(undefined, undefined),
    "Giờ bắt đầu và giờ kết thúc ca không được để trống",
  );

  // Valid standard shift
  assert.equal(getTimeValidationError("08:00", "17:00"), null);
  assert.equal(getTimeValidationError("08:00:00", "17:30:00"), null);

  // Boundary 30 minutes
  assert.equal(getTimeValidationError("08:00", "08:30"), null);

  // Under 30 minutes: 29 minutes and 20 minutes
  assert.equal(
    getTimeValidationError("08:00", "08:29"),
    "Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên",
  );
  assert.equal(
    getTimeValidationError("08:00", "08:20"),
    "Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên",
  );

  // Boundary 16 hours
  assert.equal(getTimeValidationError("06:00", "22:00"), null);

  // Exceeds 16 hours: 16 hours 1 min and 17 hours
  assert.equal(
    getTimeValidationError("06:00", "22:01"),
    "Thời lượng ca làm việc tối đa không được vượt quá 16 giờ",
  );
  assert.equal(
    getTimeValidationError("06:00", "23:00"),
    "Thời lượng ca làm việc tối đa không được vượt quá 16 giờ",
  );

  // End before start (overnight not supported)
  assert.equal(
    getTimeValidationError("17:00", "08:00"),
    "Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)",
  );

  // End equals start (0 duration)
  assert.equal(
    getTimeValidationError("08:00", "08:00"),
    "Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)",
  );

  // Invalid time string
  assert.equal(
    getTimeValidationError("abc", "17:00"),
    "Định dạng thời gian không hợp lệ",
  );
});

test("sidebar displays /my-schedule for both admin and standard users and handles edge cases", () => {
  function renderSidebar(roles, pathname = "/dashboard", isMobile = false) {
    let capturedHrefs = [];
    let capturedActiveHrefs = [];
    const jsxRuntime = {
      jsx: (type, props) => {
        if (props?.href) {
          capturedHrefs.push(props.href);
          if (props.className && props.className.includes("text-indigo-600")) {
            capturedActiveHrefs.push(props.href);
          }
        }
        return { type, props };
      },
      jsxs: (type, props) => {
        if (props?.href) {
          capturedHrefs.push(props.href);
          if (props.className && props.className.includes("text-indigo-600")) {
            capturedActiveHrefs.push(props.href);
          }
        }
        return { type, props };
      },
      Fragment: Symbol.for("react.fragment"),
    };
    const dummyIcon = () => null;
    const { Sidebar } = loadTs(
      "components/layout/sidebar.tsx",
      {},
      {
        "react/jsx-runtime": jsxRuntime,
        "@/hooks/use-auth": {
          useAuth: () => ({
            hasRole: (role) => roles.includes(role),
          }),
        },
        "@/lib/utils": {
          cn: (...args) => args.filter(Boolean).join(" "),
        },
        "next/link": (props) => ({ type: "a", props }),
        "next/navigation": {
          usePathname: () => pathname,
        },
        "lucide-react": new Proxy(
          {},
          {
            get: () => dummyIcon,
          },
        ),
      },
    );

    const vdom = Sidebar({ isMobile });
    return { vdom, hrefs: capturedHrefs, activeHrefs: capturedActiveHrefs };
  }

  // Admin user
  const adminResult = renderSidebar(["ROLE_ADMIN", "ROLE_USER"]);
  assert.ok(
    adminResult.hrefs.includes("/my-schedule"),
    "Admin sidebar must include /my-schedule",
  );
  assert.ok(
    adminResult.hrefs.includes("/employees"),
    "Admin sidebar must include /employees",
  );
  assert.ok(
    adminResult.hrefs.includes("/shifts"),
    "Admin sidebar must include /shifts",
  );
  assert.ok(
    adminResult.hrefs.includes("/alerts"),
    "Admin sidebar must include /alerts",
  );

  // Admin with only ROLE_ADMIN
  const adminOnlyResult = renderSidebar(["ROLE_ADMIN"]);
  assert.ok(
    adminOnlyResult.hrefs.includes("/my-schedule"),
    "Admin-only sidebar must include /my-schedule",
  );

  // Standard user
  const userResult = renderSidebar(["ROLE_USER"]);
  assert.ok(
    userResult.hrefs.includes("/my-schedule"),
    "User sidebar must include /my-schedule",
  );
  assert.ok(
    !userResult.hrefs.includes("/employees"),
    "User sidebar must NOT include /employees",
  );
  assert.ok(
    !userResult.hrefs.includes("/shifts"),
    "User sidebar must NOT include /shifts",
  );
  assert.ok(
    !userResult.hrefs.includes("/alerts"),
    "User sidebar must NOT include /alerts",
  );

  // Mobile drawer rendering (isMobile: true)
  const mobileResult = renderSidebar(["ROLE_USER"], "/dashboard", true);
  assert.ok(
    mobileResult.hrefs.includes("/my-schedule"),
    "Mobile sidebar must include /my-schedule",
  );

  // Null pathname edge case during SSR/hydration must not throw
  assert.doesNotThrow(() => {
    const nullPathResult = renderSidebar(["ROLE_USER"], null);
    assert.ok(
      nullPathResult.hrefs.includes("/my-schedule"),
      "Sidebar with null pathname renders items safely",
    );
    assert.equal(
      nullPathResult.activeHrefs.length,
      0,
      "No item active when pathname is null",
    );
  }, "Sidebar must not crash when pathname is null");

  // Sub-path and prefix boundary matching
  const subRouteResult = renderSidebar(["ROLE_ADMIN"], "/employees/123");
  assert.ok(
    subRouteResult.activeHrefs.includes("/employees"),
    "Sub-route /employees/123 must activate /employees menu item",
  );

  const prefixCollisionResult = renderSidebar(["ROLE_ADMIN"], "/shifts-archived");
  assert.ok(
    !prefixCollisionResult.activeHrefs.includes("/shifts"),
    "Unrelated route /shifts-archived must NOT activate /shifts menu item",
  );
});

test("header displays responsive title and resolves page titles correctly", () => {
  function renderHeader(pathname, user = { fullName: "Nguyễn Văn A", roles: ["ROLE_ADMIN"] }) {
    const jsxRuntime = {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: Symbol.for("react.fragment"),
    };
    const dummyIcon = () => null;
    const { Header } = loadTs(
      "components/layout/header.tsx",
      {},
      {
        "react/jsx-runtime": jsxRuntime,
        "@/hooks/use-auth": {
          useAuth: () => ({
            user,
            logout: () => {},
          }),
        },
        "@/components/layout/notification-bell": {
          NotificationBell: () => null,
        },
        "@/components/layout/sidebar": {
          Sidebar: () => null,
        },
        "@/components/ui/sheet": {
          Sheet: ({ children }) => children,
          SheetContent: ({ children }) => children,
          SheetDescription: ({ children }) => children,
          SheetTitle: ({ children }) => children,
          SheetTrigger: ({ render, children }) => render || children,
        },
        "next/image": (props) => ({ type: "img", props }),
        "next/navigation": {
          usePathname: () => pathname,
        },
        "lucide-react": new Proxy(
          {},
          {
            get: () => dummyIcon,
          },
        ),
      },
    );

    return Header();
  }

  function findNodes(node, predicate, acc = []) {
    if (!node) return acc;
    if (predicate(node)) acc.push(node);
    if (node.props?.children) {
      const children = Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children];
      for (const child of children) {
        findNodes(child, predicate, acc);
      }
    }
    return acc;
  }

  // Check title matching across different routes including null/empty and subroutes
  const testCases = [
    ["/my-schedule", "Lịch của tôi"],
    ["/dashboard", "Tổng quan"],
    ["/employees", "Nhân viên"],
    ["/employees/123", "Nhân viên"],
    ["/attendance", "Chấm công"],
    ["/shifts", "Ca làm việc"],
    ["/shifts/preview", "Ca làm việc"],
    ["/shifts-archived", "Tổng quan"], // prefix collision check
    ["/leave-requests", "Nghỉ phép"],
    ["/alerts", "Cảnh báo"],
    ["/profile", "Hồ sơ"],
    ["/other-route", "Tổng quan"],
    ["", "Tổng quan"],
    [null, "Tổng quan"],
    [undefined, "Tổng quan"],
  ];

  for (const [path, expectedTitle] of testCases) {
    const vdom = renderHeader(path);
    const headings = findNodes(vdom, (n) => n.type === "h1");
    assert.equal(headings.length, 1, `Expected one h1 heading on route ${path}`);
    assert.equal(
      headings[0].props.children,
      expectedTitle,
      `Header title for ${path} should be ${expectedTitle}`,
    );

    // Verify title attribute for accessibility when truncated
    assert.equal(
      headings[0].props.title,
      expectedTitle,
      `Heading must include title attribute matching "${expectedTitle}"`,
    );

    // Verify responsiveness & truncation classes
    assert.ok(
      headings[0].props.className.includes("truncate"),
      "Heading must include truncate class",
    );
    assert.ok(
      headings[0].props.className.includes("text-base sm:text-xl"),
      "Heading must be responsive font size",
    );

    // Verify title container is not hidden on mobile and has min-w-0
    const titleContainers = findNodes(
      vdom,
      (n) =>
        typeof n.props?.className === "string" &&
        n.props.className.includes("gap-2.5 sm:gap-3"),
    );
    assert.equal(titleContainers.length, 1, "Expected title container");
    assert.ok(
      !titleContainers[0].props.className.includes("hidden"),
      "Title container must not be hidden on mobile/tablet",
    );
    assert.ok(
      titleContainers[0].props.className.includes("min-w-0"),
      "Title container must have min-w-0 for ellipsis truncation",
    );
  }

  // Edge cases for user authentication state (null user, missing roles array)
  assert.doesNotThrow(() => {
    const vdomNullUser = renderHeader("/dashboard", null);
    const names = findNodes(vdomNullUser, (n) => n.props?.children === "Người dùng");
    assert.ok(names.length > 0, "Renders fallback name for null user");
  }, "Header must not crash when user is null");

  assert.doesNotThrow(() => {
    const vdomNoRoles = renderHeader("/dashboard", { fullName: "Test User" });
    const roles = findNodes(vdomNoRoles, (n) => n.props?.children === "Nhân viên");
    assert.ok(roles.length > 0, "Renders default employee role when roles array is missing");
  }, "Header must not crash when user.roles is missing");
});

function findNodes(node, predicate, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) findNodes(item, predicate, acc);
    return acc;
  }
  if (predicate(node)) acc.push(node);
  if (node.props?.children) {
    const children = Array.isArray(node.props.children)
      ? node.props.children
      : [node.props.children];
    for (const child of children) {
      findNodes(child, predicate, acc);
    }
  }
  return acc;
}

const sharedJsxRuntime = {
  jsx: (type, props) => (typeof type === "function" ? type(props) : { type, props }),
  jsxs: (type, props) => (typeof type === "function" ? type(props) : { type, props }),
  Fragment: Symbol.for("react.fragment"),
};

const dummyIcon = () => null;

test("employee table pins actions column on horizontal scroll and keeps face ID buttons visible", () => {
  const { EmployeeTable } = loadTs(
    "components/employees/employee-table.tsx",
    {},
    {
      "react/jsx-runtime": sharedJsxRuntime,
      "@/components/ui/button": {
        Button: (props) => ({ type: "button", props }),
      },
      "@/components/ui/pagination": {
        Pagination: (props) => ({ type: "pagination", props }),
      },
      "@/components/ui/table": {
        Table: (props) => ({ type: "table", props }),
        TableHeader: (props) => ({ type: "thead", props }),
        TableBody: (props) => ({ type: "tbody", props }),
        TableRow: (props) => ({ type: "tr", props }),
        TableHead: (props) => ({ type: "th", props }),
        TableCell: (props) => ({ type: "td", props }),
      },
      "@/lib/utils": {
        formatDateTime: (str) => str ?? "—",
      },
      "lucide-react": new Proxy({}, { get: () => dummyIcon }),
    },
  );

  const mockEmployees = [
    {
      id: 1,
      employeeCode: "NV001",
      fullName: "Nguyễn Văn A",
      email: "a@example.com",
      phone: "0901234567",
      status: "ACTIVE",
      roles: ["ROLE_USER"],
      hasRegisteredFace: true,
      createdAt: "2026-10-01T08:00:00",
    },
    {
      id: 2,
      employeeCode: "NV002",
      fullName: "Trần Thị B",
      email: "b@example.com",
      phone: null,
      status: "INACTIVE",
      roles: ["ROLE_ADMIN"],
      hasRegisteredFace: false,
      createdAt: "2026-10-02T09:00:00",
    },
  ];

  let openedFaceEmp = null;
  let openedEkycEmp = null;
  let deletedFaceEmp = null;

  const defaultProps = {
    isLoading: false,
    columnVis: {
      employeeCode: true,
      fullName: true,
      emailPhone: true,
      status: true,
      ekycFaceId: true,
      createdAt: true,
      actions: true,
    },
    employees: mockEmployees,
    openDetailModal: () => {},
    openFaceModal: (emp) => { openedFaceEmp = emp; },
    openEkycModal: (emp) => { openedEkycEmp = emp; },
    handleDeleteFace: (emp) => { deletedFaceEmp = emp; },
    handleOpenEdit: () => {},
    handleDelete: () => {},
    page: 0,
    totalPages: 1,
    setPage: () => {},
    fetchEmployees: () => {},
  };

  const vdom = EmployeeTable(defaultProps);

  // 1. ST3-01: TableHead actions column has sticky classes and styling
  const actionHeads = findNodes(
    vdom,
    (n) => n.type === "th" && n.props?.children === "Hành động",
  );
  assert.equal(actionHeads.length, 1, "Must render exactly one actions TableHead");
  const headClasses = actionHeads[0].props.className || "";
  assert.ok(headClasses.includes("sticky"), "Action head must be sticky");
  assert.ok(headClasses.includes("right-0"), "Action head must stick to right-0");
  assert.ok(headClasses.includes("z-10"), "Action head must have z-10");
  assert.ok(headClasses.includes("bg-slate-50/95"), "Action head must have backdrop background");
  assert.ok(headClasses.includes("backdrop-blur-sm"), "Action head must have backdrop blur");
  assert.ok(
    headClasses.includes("shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]"),
    "Action head must have left shadow",
  );

  // 2. ST3-01: TableCell actions of employee rows has sticky classes and hover styling
  const actionCells = findNodes(
    vdom,
    (n) =>
      n.type === "td" &&
      typeof n.props?.className === "string" &&
      n.props.className.includes("sticky right-0"),
  );
  assert.equal(
    actionCells.length,
    mockEmployees.length,
    "Each row must have a sticky actions TableCell",
  );
  for (const cell of actionCells) {
    const cellClasses = cell.props.className;
    assert.ok(cellClasses.includes("sticky right-0 z-10"), "Action cell must be sticky right-0 z-10");
    assert.ok(cellClasses.includes("bg-white"), "Action cell must have bg-white");
    assert.ok(cellClasses.includes("group-hover:bg-slate-50/95"), "Action cell must have group-hover bg");
    assert.ok(cellClasses.includes("transition-colors"), "Action cell must have transition-colors");
    assert.ok(
      cellClasses.includes("shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]"),
      "Action cell must have left shadow",
    );
  }

  // 3. ST3-02: Face ID buttons container must NOT contain opacity-0, group-hover:opacity-100, or transition-opacity
  const faceButtonContainers = findNodes(
    vdom,
    (n) =>
      n.type === "div" &&
      typeof n.props?.className === "string" &&
      n.props.className.includes("border border-slate-100 rounded-lg shadow-sm overflow-hidden"),
  );
  assert.equal(faceButtonContainers.length, 1, "Must find Face ID buttons container for emp with face");
  const faceBtnClasses = faceButtonContainers[0].props.className;
  assert.ok(!faceBtnClasses.includes("opacity-0"), "Face ID buttons must NOT have opacity-0");
  assert.ok(
    !faceBtnClasses.includes("group-hover:opacity-100"),
    "Face ID buttons must NOT require hover to be visible",
  );
  assert.ok(
    !faceBtnClasses.includes("transition-opacity"),
    "Face ID buttons must NOT have transition-opacity",
  );

  // Verify 3 Face ID buttons inside the container
  const faceBtns = findNodes(faceButtonContainers[0], (n) => n.type === "button");
  assert.equal(faceBtns.length, 3, "Face ID container must contain 3 buttons (View, Re-enroll, Delete)");
  assert.equal(faceBtns[0].props.title, "Xem khuôn mặt");
  assert.equal(faceBtns[1].props.title, "Quét lại Face ID");
  assert.equal(faceBtns[2].props.title, "Xóa dữ liệu khuôn mặt");

  faceBtns[0].props.onClick();
  assert.equal(openedFaceEmp?.id, 1, "Clicking 'Xem khuôn mặt' triggers openFaceModal");
  faceBtns[1].props.onClick();
  assert.equal(openedEkycEmp?.id, 1, "Clicking 'Quét lại Face ID' triggers openEkycModal");
  faceBtns[2].props.onClick();
  assert.equal(deletedFaceEmp?.id, 1, "Clicking 'Xóa dữ liệu khuôn mặt' triggers handleDeleteFace");

  // Employee without Face ID (emp 2)
  const noFaceButtons = findNodes(
    vdom,
    (n) =>
      n.type === "button" &&
      typeof n.props?.className === "string" &&
      n.props.className.includes("text-indigo-600 border-indigo-200"),
  );
  assert.equal(noFaceButtons.length, 1, "Must render 'Quét khuôn mặt' button for employee without Face ID");
  const noFaceText = findNodes(noFaceButtons[0], (n) => typeof n === "string").join(" ");
  assert.ok(noFaceText.includes("Quét"), "Button text must contain 'Quét'");
  assert.ok(
    !noFaceButtons[0].props.className?.includes("opacity-0"),
    "Face ID enroll button must not have opacity-0",
  );

  // Row action buttons: User vs Admin
  const rowActionButtons = findNodes(
    vdom,
    (n) => n.type === "button" && (n.props?.title === "Chỉnh sửa" || n.props?.title === "Vô hiệu hóa"),
  );
  assert.equal(rowActionButtons.length, 4, "Must render 2 action buttons per row (total 4 for 2 rows)");
  assert.equal(rowActionButtons[1].props.disabled, false, "ROLE_USER delete button must be enabled");
  assert.equal(rowActionButtons[3].props.disabled, true, "ROLE_ADMIN delete button must be disabled");

  // Row phone number render check (emp.phone vs fallback)
  const phone1 = findNodes(vdom, (n) => n.props?.children === "0901234567");
  assert.equal(phone1.length, 1, "Employee phone number must be rendered");
  const fallbackPhones = findNodes(vdom, (n) => n.props?.children === "—");
  assert.ok(fallbackPhones.length >= 1, "Fallback '—' rendered for null phone");

  // 4. Edge cases:
  // Hidden actions column: neither TableHead nor TableCell should be rendered
  const vdomNoActions = EmployeeTable({
    ...defaultProps,
    columnVis: { ...defaultProps.columnVis, actions: false },
  });
  const noActionHeads = findNodes(
    vdomNoActions,
    (n) => n.type === "th" && n.props?.children === "Hành động",
  );
  assert.equal(noActionHeads.length, 0, "No action head rendered when columnVis.actions is false");
  const noActionCells = findNodes(
    vdomNoActions,
    (n) =>
      n.type === "td" &&
      typeof n.props?.className === "string" &&
      n.props.className.includes("sticky right-0"),
  );
  assert.equal(noActionCells.length, 0, "No action cell rendered when columnVis.actions is false");

  // Hidden Face ID column
  const vdomNoFace = EmployeeTable({
    ...defaultProps,
    columnVis: { ...defaultProps.columnVis, ekycFaceId: false },
  });
  const noFaceHeads = findNodes(
    vdomNoFace,
    (n) => n.type === "th" && n.props?.children === "eKYC Face ID",
  );
  assert.equal(noFaceHeads.length, 0, "No Face ID head rendered when columnVis.ekycFaceId is false");

  // Loading state
  const vdomLoading = EmployeeTable({
    ...defaultProps,
    isLoading: true,
  });
  const loadingTexts = findNodes(
    vdomLoading,
    (n) => n.props?.children === "Đang tải dữ liệu nhân viên...",
  );
  assert.equal(loadingTexts.length, 1, "Renders loading state properly");

  // Empty state
  const vdomEmpty = EmployeeTable({
    ...defaultProps,
    employees: [],
  });
  const emptyTexts = findNodes(
    vdomEmpty,
    (n) => n.props?.children === "Không tìm thấy nhân viên nào phù hợp",
  );
  assert.equal(emptyTexts.length, 1, "Renders empty state message when employees list is empty");
  const emptyColSpanCells = findNodes(
    vdomEmpty,
    (n) => n.type === "td" && n.props?.colSpan === 7,
  );
  assert.equal(emptyColSpanCells.length, 1, "Empty row spans all 7 visible columns");
});

test("shift catalog edit and delete buttons are always visible without hover", () => {
  const { ShiftCatalog } = loadTs(
    "components/shifts/shift-catalog.tsx",
    {},
    {
      "react/jsx-runtime": sharedJsxRuntime,
      "@/components/ui/badge": {
        Badge: (props) => ({ type: "badge", props }),
      },
      "@/components/ui/card": {
        Card: (props) => ({ type: "card", props }),
        CardHeader: (props) => ({ type: "card-header", props }),
        CardTitle: (props) => ({ type: "card-title", props }),
        CardContent: (props) => ({ type: "card-content", props }),
      },
      "@/lib/shifts-helpers": {
        SHIFT_COLORS: [
          { text: "text-blue-700", border: "border-blue-200", bg: "bg-blue-50" },
        ],
      },
      "lucide-react": new Proxy({}, { get: () => dummyIcon }),
    },
  );

  const mockShifts = [
    {
      id: 1,
      shiftCode: "DEFAULT",
      name: "Ca Hành Chính",
      startTime: "08:00:00",
      endTime: "17:00:00",
      gracePeriodMinutes: 15,
      active: true,
    },
    {
      id: 2,
      shiftCode: "S1",
      name: "Ca Sáng",
      startTime: "06:00:00",
      endTime: "14:00:00",
      gracePeriodMinutes: 10,
      active: false,
    },
  ];

  let editedShift = null;
  let deletedShift = null;

  const defaultProps = {
    shifts: mockShifts,
    includeInactive: true,
    setIncludeInactive: () => {},
    handleOpenEdit: (shift) => { editedShift = shift; },
    handleOpenDelete: (shift) => { deletedShift = shift; },
  };

  const vdom = ShiftCatalog(defaultProps);

  // ST4-04: Button containers must NOT have opacity-0, hover-only opacity, or transition-opacity
  const editButtons = findNodes(
    vdom,
    (n) => n.type === "button" && n.props?.title === "Chỉnh sửa ca",
  );
  assert.equal(editButtons.length, mockShifts.length, "Each shift card must have an edit button");

  const cards = findNodes(vdom, (n) => n.type === "card");
  assert.equal(cards.length, mockShifts.length, "Renders a card for each shift");

  for (const card of cards) {
    const actionContainers = findNodes(
      card,
      (n) =>
        n.type === "div" &&
        n.props?.className === "flex items-center gap-1",
    );
    assert.equal(actionContainers.length, 1, "Each card must have exactly one action container");
    const classes = actionContainers[0].props.className || "";
    assert.ok(
      classes.includes("flex items-center gap-1"),
      "Action container must maintain flex items-center gap-1",
    );
    assert.ok(!classes.includes("opacity-0"), "Shift action buttons container must NOT contain opacity-0");
    assert.ok(
      !classes.includes("group-hover:opacity-100"),
      "Shift action buttons container must NOT require hover to be visible",
    );
    assert.ok(
      !classes.includes("transition-opacity"),
      "Shift action buttons container must NOT contain transition-opacity",
    );
  }

  // Default shift cannot be deleted (only 1 edit button in container)
  const defaultCard = cards[0];
  const defaultButtons = findNodes(defaultCard, (n) => n.type === "button");
  assert.equal(defaultButtons.length, 1, "Default shift card must only have edit button");
  assert.equal(defaultButtons[0].props.title, "Chỉnh sửa ca");

  defaultButtons[0].props.onClick();
  assert.equal(editedShift?.id, 1, "Clicking edit button calls handleOpenEdit with default shift");

  // Non-default shift has both edit and delete buttons
  const customCard = cards[1];
  const customButtons = findNodes(customCard, (n) => n.type === "button");
  assert.equal(customButtons.length, 2, "Custom shift card must have edit and delete buttons");
  assert.equal(customButtons[0].props.title, "Chỉnh sửa ca");
  assert.equal(customButtons[1].props.title, "Xóa / Ngừng sử dụng ca");

  customButtons[0].props.onClick();
  assert.equal(editedShift?.id, 2, "Clicking edit button calls handleOpenEdit with custom shift");
  customButtons[1].props.onClick();
  assert.equal(deletedShift?.id, 2, "Clicking delete button calls handleOpenDelete with custom shift");

  // Inactive shift badge & styling
  const inactiveBadges = findNodes(
    vdom,
    (n) => n.type === "badge" && n.props?.children === "Ngừng dùng",
  );
  assert.equal(inactiveBadges.length, 1, "Inactive shift must display 'Ngừng dùng' badge");
  assert.ok(
    customCard.props.className.includes("border-dashed"),
    "Inactive shift card must have border-dashed styling",
  );

  // Edge case: Empty shifts list
  const emptyVdom = ShiftCatalog({
    ...defaultProps,
    shifts: [],
  });
  const emptyCards = findNodes(emptyVdom, (n) => n.type === "card");
  assert.equal(emptyCards.length, 0, "Empty shifts renders 0 cards without error");
});

test("formatDate and formatDateTime format pure ISO, local datetime, offset ISO, and edge cases correctly", () => {
  const { formatDate, formatDateTime } = loadTs("lib/utils.ts", {}, {
    cn: (...args) => args.filter(Boolean).join(" "),
  });

  // 1. Pure ISO date strings (avoids timezone roll-over shift)
  assert.equal(formatDate("2026-10-17"), "17/10/2026");
  assert.equal(formatDateTime("2026-10-17"), "00:00 17/10/2026");
  assert.equal(formatDate("2026-05-03"), "03/05/2026");
  assert.equal(formatDateTime("2026-05-03"), "00:00 03/05/2026");
  // Single-digit month and day
  assert.equal(formatDate("2026-5-3"), "03/05/2026");
  assert.equal(formatDateTime("2026-5-3"), "00:00 03/05/2026");
  // Whitespace-padded pure ISO date strings
  assert.equal(formatDate("  2026-10-17  "), "17/10/2026");
  assert.equal(formatDateTime("  2026-10-17  "), "00:00 17/10/2026");

  // 2. LocalDateTime strings without offset (both T and space separator, with or without microsecond decimals)
  assert.equal(formatDate("2026-10-17T14:30:00"), "17/10/2026");
  assert.equal(formatDateTime("2026-10-17T14:30:00"), "14:30 17/10/2026");
  assert.equal(formatDate("2026-10-17 14:30:00.123456"), "17/10/2026");
  assert.equal(formatDateTime("2026-10-17 14:30:00.123456"), "14:30 17/10/2026");
  assert.equal(formatDate("2026-10-17T08:05"), "17/10/2026");
  assert.equal(formatDateTime("2026-10-17T08:05"), "08:05 17/10/2026");
  assert.equal(formatDate("  2026-10-17T14:30:00  "), "17/10/2026");
  assert.equal(formatDateTime("  2026-10-17T14:30:00  "), "14:30 17/10/2026");

  // 3. Date object & ISO string with offset (Z, +07:00, -05:00)
  const localDateObj = new Date(2026, 9, 17, 14, 30, 0); // month 9 is October
  assert.equal(formatDate(localDateObj), "17/10/2026");
  assert.equal(formatDateTime(localDateObj), "14:30 17/10/2026");

  // Offset Z string: check that format matches Date object interpretation
  const zString = "2026-10-17T14:30:00Z";
  const zDate = new Date(zString);
  const expZH = String(zDate.getHours()).padStart(2, "0");
  const expZM = String(zDate.getMinutes()).padStart(2, "0");
  const expZD = String(zDate.getDate()).padStart(2, "0");
  const expZMo = String(zDate.getMonth() + 1).padStart(2, "0");
  const expZY = zDate.getFullYear();
  assert.equal(formatDateTime(zString), `${expZH}:${expZM} ${expZD}/${expZMo}/${expZY}`);
  assert.equal(formatDate(zString), `${expZD}/${expZMo}/${expZY}`);

  // Offset +07:00 string
  const offsetString = "2026-10-17T14:30:00+07:00";
  const offsetDate = new Date(offsetString);
  const expOH = String(offsetDate.getHours()).padStart(2, "0");
  const expOM = String(offsetDate.getMinutes()).padStart(2, "0");
  const expOD = String(offsetDate.getDate()).padStart(2, "0");
  const expOMo = String(offsetDate.getMonth() + 1).padStart(2, "0");
  const expOY = offsetDate.getFullYear();
  assert.equal(formatDateTime(offsetString), `${expOH}:${expOM} ${expOD}/${expOMo}/${expOY}`);
  assert.equal(formatDate(offsetString), `${expOD}/${expOMo}/${expOY}`);

  // 4. Leap year 2024-02-29 valid vs non-leap / invalid / roll-over dates -> "—"
  assert.equal(formatDate("2024-02-29"), "29/02/2024");
  assert.equal(formatDateTime("2024-02-29"), "00:00 29/02/2024");
  assert.equal(formatDate("2024-02-29T10:15:00"), "29/02/2024");
  assert.equal(formatDateTime("2024-02-29T10:15:00"), "10:15 29/02/2024");
  assert.equal(formatDate("2020-02-29"), "29/02/2020");
  assert.equal(formatDate("2000-02-29"), "29/02/2000"); // Century leap year
  assert.equal(formatDate("1900-02-29"), "—"); // Century non-leap year

  const invalidDates = [
    "2025-02-29",
    "2026-02-29",
    "2026-02-31",
    "2026-04-31",
    "2026-06-31",
    "2026-09-31",
    "2026-11-31",
    "2026-13-01",
    "2026-02-31T14:30:00Z",
    "2026-02-31T14:30:00+07:00",
    "2025-02-29T10:00:00+07:00",
    "2026-04-31T14:30:00Z",
    "2025-02-29T10:00:00",
    "2025-02-29 10:00:00",
    "2026-00-10",
    "2026-10-00",
    "2026-10-32",
    "2026-10-17T24:00:00",
    "2026-10-17T14:60:00",
    "2026-10-17T14:30:60",
    "0999-10-17",
  ];
  for (const inv of invalidDates) {
    assert.equal(formatDate(inv), "—", `formatDate must return "—" for invalid date: ${inv}`);
    assert.equal(formatDateTime(inv), "—", `formatDateTime must return "—" for invalid date: ${inv}`);
  }

  // 5. Empty / weird / non-date values -> "—"
  assert.equal(formatDate(), "—", "formatDate with no arguments must return '—'");
  assert.equal(formatDateTime(), "—", "formatDateTime with no arguments must return '—'");

  const weirdValues = [
    null,
    undefined,
    "",
    "   ",
    "abc",
    "invalid-date",
    new Date(NaN),
    true,
    false,
    12345,
    0,
    {},
    [],
    () => {},
  ];
  for (const weird of weirdValues) {
    assert.equal(formatDate(weird), "—", `formatDate must return "—" for weird value: ${String(weird)}`);
    assert.equal(formatDateTime(weird), "—", `formatDateTime must return "—" for weird value: ${String(weird)}`);
  }
});

function createLeaveHarness({ user, leaveServiceMock }) {
  let states = [];
  let stateCursor = 0;
  let effectSlots = [];
  let effectCursor = 0;
  let callbackSlots = [];
  let callbackCursor = 0;
  let currentTree = null;
  const toastErrors = [];
  const toastSuccesses = [];

  const toastError = (msg) => { toastErrors.push(msg); };
  const toastSuccess = (msg) => { toastSuccesses.push(msg); };
  const toastObj = { error: toastError, success: toastSuccess };
  const beginRequestFn = () => () => true;

  function shallowEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  const mockReact = {
    useState(initial) {
      const idx = stateCursor++;
      if (states.length <= idx) {
        states.push(typeof initial === "function" ? initial() : initial);
      }
      const setState = (next) => {
        const nextVal = typeof next === "function" ? next(states[idx]) : next;
        if (states[idx] !== nextVal) {
          states[idx] = nextVal;
          scheduleRender();
        }
      };
      return [states[idx], setState];
    },
    useCallback(fn, deps) {
      const idx = callbackCursor++;
      if (callbackSlots.length <= idx) {
        callbackSlots.push({ fn, deps });
        return fn;
      }
      const slot = callbackSlots[idx];
      if (deps && shallowEqual(slot.deps, deps)) {
        return slot.fn;
      }
      callbackSlots[idx] = { fn, deps };
      return fn;
    },
    useRef(val) {
      return { current: val };
    },
    useEffect(fn, deps) {
      const idx = effectCursor++;
      if (effectSlots.length <= idx) {
        effectSlots.push({ fn, deps, run: true });
        return;
      }
      const slot = effectSlots[idx];
      if (!deps || !shallowEqual(slot.deps, deps)) {
        slot.fn = fn;
        slot.deps = deps;
        slot.run = true;
      }
    },
  };

  let PageComponent;
  let isRendering = false;
  let pendingRender = false;

  function doRender() {
    if (isRendering) {
      pendingRender = true;
      return;
    }
    isRendering = true;
    try {
      do {
        pendingRender = false;
        stateCursor = 0;
        effectCursor = 0;
        callbackCursor = 0;
        currentTree = PageComponent();
        for (const slot of effectSlots) {
          if (slot.run) {
            slot.run = false;
            slot.fn();
          }
        }
      } while (pendingRender);
    } finally {
      isRendering = false;
    }
  }

  function scheduleRender() {
    if (PageComponent) {
      doRender();
    }
  }

  const jsxRuntime = {
    jsx: (type, props) => (typeof type === "function" ? type(props) : { type, props }),
    jsxs: (type, props) => (typeof type === "function" ? type(props) : { type, props }),
    Fragment: Symbol.for("react.fragment"),
  };

  const { formatDate, formatDateTime } = loadTs("lib/utils.ts", {}, {
    cn: (...args) => args.filter(Boolean).join(" "),
  });
  const { getErrorMessage } = loadTs("lib/errors.ts");

  const pageModule = loadTs(
    "app/(dashboard)/leave-requests/page.tsx",
    {},
    {
      react: mockReact,
      "react/jsx-runtime": jsxRuntime,
      "@/lib/errors": { getErrorMessage },
      "@/components/ui/badge": { Badge: (props) => ({ type: "badge", props }) },
      "@/components/ui/button": { Button: (props) => ({ type: "button", props }) },
      "@/components/ui/modal": {
        Modal: ({ isOpen, onClose, title, children, className }) => ({
          type: "modal",
          props: { isOpen, onClose, title, children, className },
        }),
      },
      "@/components/ui/pagination": { Pagination: (props) => ({ type: "pagination", props }) },
      "@/components/ui/table": {
        Table: (props) => ({ type: "table", props }),
        TableHeader: (props) => ({ type: "thead", props }),
        TableBody: (props) => ({ type: "tbody", props }),
        TableRow: (props) => ({ type: "tr", props }),
        TableHead: (props) => ({ type: "th", props }),
        TableCell: (props) => ({ type: "td", props }),
      },
      "@/components/ui/toast": {
        useToast: () => toastObj,
      },
      "@/hooks/use-auth": {
        useAuth: () => ({
          user,
          hasRole: (role) => (user?.roles || []).includes(role),
        }),
      },
      "@/hooks/use-latest-request": {
        useLatestRequest: () => beginRequestFn,
      },
      "@/lib/utils": { formatDate, formatDateTime },
      "@/services/leave.service": { leaveService: leaveServiceMock },
      "lucide-react": new Proxy({}, { get: () => () => null }),
    },
  );

  PageComponent = pageModule.default;
  doRender();

  return {
    getTree: () => currentTree,
    toastErrors,
    toastSuccesses,
    flush: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  };
}

test("leave requests page displays dates correctly and enforces confirmation modal with validation for approval and rejection", async () => {
  const mockAdmin = { id: 1, fullName: "Admin User", roles: ["ROLE_ADMIN"] };
  const mockRequests = [
    {
      id: 101,
      userId: 2,
      employeeCode: "NV002",
      fullName: "Trần Thị B",
      startDate: "2026-10-17",
      endDate: "2026-10-20",
      reason: "Nghỉ việc cá nhân",
      status: "PENDING",
      approvedByName: null,
      createdAt: "2026-10-15T09:30:00",
    },
    {
      id: 102,
      userId: 3,
      employeeCode: "NV003",
      fullName: "Lê Văn C",
      startDate: "2026-10-18",
      endDate: "2026-10-19",
      reason: "Khám sức khỏe",
      status: "APPROVED",
      approvedByName: "Admin User",
      createdAt: "2026-10-14T14:20:00",
    },
  ];

  const approveCalls = [];
  let getAllCalls = 0;
  const leaveServiceMock = {
    getAll: async () => {
      getAllCalls++;
      return {
        status: "SUCCESS",
        data: { content: mockRequests, totalPages: 1, pageNumber: 0 },
      };
    },
    approve: async (id, data) => {
      approveCalls.push({ id, data });
      return { status: "SUCCESS", data: {} };
    },
  };

  const harness = createLeaveHarness({ user: mockAdmin, leaveServiceMock });
  await harness.flush();

  // 1. Verify date formatting: ST5-08 (dd/MM/yyyy) & ST5-02 (HH:mm dd/MM/yyyy, not truncated by split(" ")[0])
  const cells = findNodes(harness.getTree(), (n) => n.type === "td");
  const cellTexts = cells.map((c) => {
    const textNodes = findNodes(c, (child) => typeof child === "string");
    return textNodes.join(" ");
  });

  assert.ok(cellTexts.some((t) => t.includes("17/10/2026")), "Start date must be formatted as 17/10/2026 (ST5-08)");
  assert.ok(cellTexts.some((t) => t.includes("20/10/2026")), "End date must be formatted as 20/10/2026 (ST5-08)");

  assert.ok(
    cellTexts.some((t) => t.includes("09:30 15/10/2026")),
    "Created time must display full 09:30 15/10/2026 without truncation (ST5-02)",
  );
  assert.ok(
    cellTexts.some((t) => t.includes("14:20 14/10/2026")),
    "Created time for second row must display full 14:20 14/10/2026 (ST5-02)",
  );

  assert.ok(cellTexts.some((t) => t.includes("Đã xử lý")), "Already processed requests show processed status");
  assert.equal(getAllCalls, 1, "Initial render must fetch requests once");

  // 2. ST5-01: Admin clicking Duyệt button must open Modal, NOT call approve API immediately
  let buttons = findNodes(harness.getTree(), (n) => n.type === "button");
  const duyetBtn = buttons.find((b) => b.props?.title === "Duyệt");
  assert.ok(duyetBtn, "Duyệt button must be present for PENDING request");

  duyetBtn.props.onClick();
  assert.equal(approveCalls.length, 0, "Clicking Duyệt must NOT call leaveService.approve immediately (ST5-01)");

  let approveModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận duyệt đơn nghỉ phép",
  )[0];
  assert.ok(approveModal, "Approval confirmation modal must open with proper title");

  const modalText = findNodes(approveModal, (n) => typeof n === "string").join(" ");
  assert.ok(modalText.includes("Trần Thị B"), "Approval modal must display employee name");
  assert.ok(modalText.includes("NV002"), "Approval modal must display employee code");
  assert.ok(modalText.includes("17/10/2026") && modalText.includes("20/10/2026"), "Approval modal must display date range");
  assert.ok(modalText.includes("Nghỉ việc cá nhân"), "Approval modal must display reason");

  let modalForm = findNodes(approveModal, (n) => n.type === "form")[0];
  assert.ok(modalForm, "Modal form must be rendered");
  modalForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.equal(approveCalls.length, 1, "Submitting approval calls leaveService.approve");
  assert.equal(approveCalls[0].id, 101);
  assert.equal(approveCalls[0].data.status, "APPROVED");
  assert.equal(approveCalls[0].data.approvedByUserId, 1);
  assert.ok(harness.toastSuccesses.includes("Đã duyệt đơn nghỉ phép"));
  assert.equal(getAllCalls, 2, "Successful approval must refetch requests list");

  approveModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Xác nhận duyệt đơn nghỉ phép",
  )[0];
  assert.equal(approveModal.props.isOpen, false, "Modal must be closed after successful approval");

  // 3. ST5-01 & Rejection validation: Admin clicking Từ chối button
  buttons = findNodes(harness.getTree(), (n) => n.type === "button");
  const tuChoiBtn = buttons.find((b) => b.props?.title === "Từ chối");
  assert.ok(tuChoiBtn, "Từ chối button must be present for PENDING request");

  tuChoiBtn.props.onClick();
  assert.equal(approveCalls.length, 1, "Clicking Từ chối must NOT call leaveService.approve immediately (ST5-01)");

  let rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  assert.ok(rejectModal, "Rejection confirmation modal must open with proper title");

  // Validation: empty note
  let rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  let rejectTextarea = findNodes(rejectModal, (n) => n.type === "textarea")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.equal(approveCalls.length, 1, "API must NOT be called when rejection note is empty");
  assert.equal(harness.toastErrors.length, 1);
  assert.equal(harness.toastErrors[0], "Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự)");

  // Validation: whitespace only
  rejectTextarea.props.onChange({ target: { value: "     " } });
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.equal(approveCalls.length, 1, "API must NOT be called when note is whitespace only");
  assert.equal(harness.toastErrors.length, 2);

  // Validation: 1 character
  rejectTextarea.props.onChange({ target: { value: " a " } });
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.equal(approveCalls.length, 1, "API must NOT be called when note is 1 char after trim");
  assert.equal(harness.toastErrors.length, 3);

  // Validation: 2 characters
  rejectTextarea.props.onChange({ target: { value: "  ko  " } });
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.equal(approveCalls.length, 1, "API must NOT be called when rejection note has 2 chars after trim");
  assert.equal(harness.toastErrors.length, 4);

  // Test Modal onClose callback (escape / backdrop click)
  rejectModal.props.onClose();
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  assert.equal(rejectModal.props.isOpen, false, "Modal onClose must close modal");
  assert.equal(approveCalls.length, 1, "API must not be called after modal close");

  // Re-open and verify note was reset to empty string
  tuChoiBtn.props.onClick();
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  rejectTextarea = findNodes(rejectModal, (n) => n.type === "textarea")[0];
  assert.equal(rejectTextarea.props.value, "", "Re-opening modal must reset reviewNote to empty");

  // Test boundary: exactly 3 characters after trim (e.g. "abc") -> must be accepted!
  rejectTextarea.props.onChange({ target: { value: "  abc  " } });
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.equal(approveCalls.length, 2, "API must be called when exactly 3 characters are provided after trim");
  assert.equal(approveCalls[1].id, 101);
  assert.equal(approveCalls[1].data.status, "REJECTED");
  assert.equal(approveCalls[1].data.approvedByUserId, 1);
  assert.ok(harness.toastSuccesses.includes("Đã từ chối đơn nghỉ phép"));
  assert.equal(getAllCalls, 3, "Successful rejection must refetch requests list");

  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  assert.equal(rejectModal.props.isOpen, false, "Modal must be closed after rejection");
});

test("leave requests page handles approval and rejection API errors by keeping modal open", async () => {
  const mockAdmin = { id: 1, fullName: "Admin User", roles: ["ROLE_ADMIN"] };
  const mockRequests = [
    {
      id: 301,
      userId: 4,
      employeeCode: "NV004",
      fullName: "Đỗ Thị D",
      startDate: "2026-10-22",
      endDate: "2026-10-25",
      reason: "Việc cá nhân",
      status: "PENDING",
      approvedByName: null,
      createdAt: "2026-10-16T08:00:00",
    },
  ];

  let shouldRejectApi = false;
  let apiErrorMessage = "";
  const leaveServiceMock = {
    getAll: async () => ({
      status: "SUCCESS",
      data: { content: mockRequests, totalPages: 1, pageNumber: 0 },
    }),
    approve: async () => {
      if (shouldRejectApi) {
        throw new Error("Mất kết nối mạng");
      }
      if (apiErrorMessage) {
        return {
          status: "ERROR",
          message: apiErrorMessage,
          response: { data: { message: apiErrorMessage } },
        };
      }
      return { status: "SUCCESS", data: {} };
    },
  };

  const harness = createLeaveHarness({ user: mockAdmin, leaveServiceMock });
  await harness.flush();

  // Test 1: API returns error status response -> modal remains open
  apiErrorMessage = "Đơn nghỉ phép này đã được xử lý bởi quản trị viên khác";
  const buttons = findNodes(harness.getTree(), (n) => n.type === "button");
  const duyetBtn = buttons.find((b) => b.props?.title === "Duyệt");
  duyetBtn.props.onClick();

  let approveModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận duyệt đơn nghỉ phép",
  )[0];
  let approveForm = findNodes(approveModal, (n) => n.type === "form")[0];
  approveForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.ok(
    harness.toastErrors.includes("Đơn nghỉ phép này đã được xử lý bởi quản trị viên khác"),
    "Must display server error message on API failure",
  );
  approveModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Xác nhận duyệt đơn nghỉ phép",
  )[0];
  assert.equal(approveModal.props.isOpen, true, "Modal must remain open when API returns error status");

  // Close modal via cancel button
  const cancelBtn = findNodes(approveModal, (n) => n.type === "button" && n.props?.children === "Hủy")[0];
  cancelBtn.props.onClick();

  // Test 2: API throws network exception -> modal remains open and retains input
  shouldRejectApi = true;
  apiErrorMessage = "";
  const tuChoiBtn = findNodes(harness.getTree(), (n) => n.type === "button" && n.props?.title === "Từ chối")[0];
  tuChoiBtn.props.onClick();

  let rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  let rejectTextarea = findNodes(rejectModal, (n) => n.type === "textarea")[0];
  rejectTextarea.props.onChange({ target: { value: "Không đồng ý vì lý do công tác" } });

  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  let rejectForm = findNodes(rejectModal, (n) => n.type === "form")[0];
  rejectForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.ok(
    harness.toastErrors.some((err) => err.includes("Mất kết nối mạng") || err.includes("Lỗi khi xử lý đơn phép")),
    "Must display toast error when network call rejects",
  );
  rejectModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Xác nhận từ chối đơn nghỉ phép",
  )[0];
  assert.equal(rejectModal.props.isOpen, true, "Modal must remain open when network call rejects");
  rejectTextarea = findNodes(rejectModal, (n) => n.type === "textarea")[0];
  assert.equal(
    rejectTextarea.props.value,
    "Không đồng ý vì lý do công tác",
    "User rejection note must be retained on network failure",
  );
});

test("leave requests page admin status filter and empty data state", async () => {
  const mockAdmin = { id: 1, fullName: "Admin User", roles: ["ROLE_ADMIN"] };
  let lastFilterStatus = null;
  let requestsToReturn = [];

  const leaveServiceMock = {
    getAll: async (page, size, status) => {
      lastFilterStatus = status;
      return {
        status: "SUCCESS",
        data: { content: requestsToReturn, totalPages: 1, pageNumber: 0 },
      };
    },
  };

  const harness = createLeaveHarness({ user: mockAdmin, leaveServiceMock });
  await harness.flush();

  // Test empty state
  const cells = findNodes(harness.getTree(), (n) => n.type === "td");
  const cellTexts = cells.map((c) => findNodes(c, (child) => typeof child === "string").join(" "));
  assert.ok(
    cellTexts.some((t) => t.includes("Không có dữ liệu đơn phép")),
    "Must show empty data placeholder when requests array is empty",
  );
  assert.equal(cells[0].props?.colSpan, 8, "Admin empty state must span 8 columns");

  // Test status filter select
  const selects = findNodes(harness.getTree(), (n) => n.type === "select");
  assert.equal(selects.length, 1, "Admin view renders status filter select");
  selects[0].props.onChange({ target: { value: "PENDING" } });
  await harness.flush();
  assert.equal(lastFilterStatus, "PENDING", "Changing select to PENDING calls getAll with PENDING filter");

  selects[0].props.onChange({ target: { value: "" } });
  await harness.flush();
  assert.equal(lastFilterStatus, undefined, "Changing select to empty calls getAll with undefined filter");
});

test("leave requests page for non-admin user loads personal requests, handles empty state, and validates create form", async () => {
  const mockEmployeeUser = { id: 5, fullName: "Phan Văn E", roles: ["ROLE_USER"] };
  const mockUserRequests = [
    {
      id: 201,
      userId: 5,
      employeeCode: "NV005",
      fullName: "Phan Văn E",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      reason: "Nghỉ phép năm",
      status: "PENDING",
      approvedByName: null,
      createdAt: "2026-10-20T10:00:00",
    },
  ];

  let getMyRequestsCalled = 0;
  const createCalls = [];
  const leaveServiceMock = {
    getMyRequests: async (userId) => {
      getMyRequestsCalled++;
      assert.equal(userId, 5);
      return { status: "SUCCESS", data: mockUserRequests };
    },
    getAll: async () => {
      throw new Error("Standard user should NOT call getAll");
    },
    create: async (data) => {
      createCalls.push(data);
      return { status: "SUCCESS", data: { id: 202, ...data } };
    },
  };

  const harness = createLeaveHarness({ user: mockEmployeeUser, leaveServiceMock });
  await harness.flush();

  assert.equal(getMyRequestsCalled, 1, "Must call getMyRequests with user id");

  // Title check: "Đơn phép của tôi"
  const titles = findNodes(harness.getTree(), (n) => n.type === "h1");
  const titleText = findNodes(titles[0], (n) => typeof n === "string").join(" ");
  assert.ok(titleText.includes("Đơn phép của tôi"), "Employee view shows 'Đơn phép của tôi'");

  // Create button exists
  const createButtons = findNodes(harness.getTree(), (n) => n.type === "button" && findNodes(n, (c) => typeof c === "string").join(" ").includes("Tạo đơn mới"));
  assert.equal(createButtons.length, 1, "Must display 'Tạo đơn mới' button for employee");

  // No admin columns: "Nhân viên" or "Hành động"
  const tableHeads = findNodes(harness.getTree(), (n) => n.type === "th");
  const headTexts = tableHeads.map((th) => findNodes(th, (c) => typeof c === "string").join(" "));
  assert.ok(!headTexts.includes("Nhân viên"), "Non-admin table does not display 'Nhân viên' column");
  assert.ok(!headTexts.includes("Hành động"), "Non-admin table does not display 'Hành động' column");

  // Dates formatted correctly in user row
  const cells = findNodes(harness.getTree(), (n) => n.type === "td");
  const cellTexts = cells.map((c) => findNodes(c, (child) => typeof child === "string").join(" "));
  assert.ok(cellTexts.some((t) => t.includes("01/11/2026")), "Start date formatted as 01/11/2026");
  assert.ok(cellTexts.some((t) => t.includes("03/11/2026")), "End date formatted as 03/11/2026");
  assert.ok(cellTexts.some((t) => t.includes("10:00 20/10/2026")), "Created time formatted as 10:00 20/10/2026");

  // Test employee "Tạo đơn mới" modal and submission validations
  createButtons[0].props.onClick();
  let createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  assert.ok(createModal, "Create leave request modal must open");

  // Submit without dates
  let createForm = findNodes(createModal, (n) => n.type === "form")[0];
  createForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.ok(
    harness.toastErrors.includes("Vui lòng chọn ngày bắt đầu và kết thúc"),
    "Must error when start or end date is missing",
  );
  assert.equal(createCalls.length, 0);

  // Submit startDate > endDate
  let dateInputs = findNodes(createModal, (n) => n.type === "input" && n.props?.type === "date");
  dateInputs[0].props.onChange({ target: { value: "2026-11-10" } });
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  dateInputs = findNodes(createModal, (n) => n.type === "input" && n.props?.type === "date");
  dateInputs[1].props.onChange({ target: { value: "2026-11-05" } });
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  createForm = findNodes(createModal, (n) => n.type === "form")[0];
  createForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.ok(
    harness.toastErrors.includes("Ngày bắt đầu không được lớn hơn ngày kết thúc"),
    "Must error when startDate > endDate",
  );
  assert.equal(createCalls.length, 0);

  // Submit reason < 5 characters
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  dateInputs = findNodes(createModal, (n) => n.type === "input" && n.props?.type === "date");
  dateInputs[1].props.onChange({ target: { value: "2026-11-12" } });
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  let reasonTextarea = findNodes(createModal, (n) => n.type === "textarea")[0];
  reasonTextarea.props.onChange({ target: { value: "Nghỉ" } });
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  createForm = findNodes(createModal, (n) => n.type === "form")[0];
  createForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();
  assert.ok(
    harness.toastErrors.includes("Lý do xin nghỉ phép phải từ 5 ký tự trở lên"),
    "Must error when reason < 5 chars",
  );
  assert.equal(createCalls.length, 0);

  // Submit valid create request
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  reasonTextarea = findNodes(createModal, (n) => n.type === "textarea")[0];
  reasonTextarea.props.onChange({ target: { value: "Nghỉ phép giải quyết việc gia đình" } });
  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.isOpen && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  createForm = findNodes(createModal, (n) => n.type === "form")[0];
  createForm.props.onSubmit({ preventDefault() {} });
  await harness.flush();

  assert.equal(createCalls.length, 1, "Must call leaveService.create with valid form");
  assert.equal(createCalls[0].userId, 5);
  assert.equal(createCalls[0].startDate, "2026-11-10");
  assert.equal(createCalls[0].endDate, "2026-11-12");
  assert.equal(createCalls[0].reason, "Nghỉ phép giải quyết việc gia đình");
  assert.ok(harness.toastSuccesses.includes("Đã gửi đơn xin nghỉ phép thành công!"));

  createModal = findNodes(
    harness.getTree(),
    (n) => n.type === "modal" && n.props?.title === "Tạo đơn xin nghỉ phép",
  )[0];
  assert.equal(createModal.props.isOpen, false, "Create modal must close on success");
  assert.equal(getMyRequestsCalled, 2, "Must refetch user requests after creating");
});



