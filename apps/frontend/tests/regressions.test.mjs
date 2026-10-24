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

// ============================================================================
// Subtask 2.2: Phân trang & Tìm kiếm cho Lịch phân ca tuần (ST4-01 + ST4-05)
// ============================================================================

test("shiftService.getSchedulePaged builds correct query string and handles parameters & encoding (ST4-01 + ST4-05)", async () => {
  const getRequests = [];
  const { shiftService } = loadTs(
    "services/shift.service.ts",
    { URLSearchParams, URL },
    {
      "@/lib/api-client": {
        apiClient: {
          get: async (url) => {
            getRequests.push(url);
            return { status: "SUCCESS", data: {} };
          },
        },
      },
    },
  );

  // 1. Default parameters: page=0, size=20, no keyword
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25");
  assert.equal(getRequests.length, 1);
  const url1 = new URL(getRequests[0], "http://localhost");
  assert.equal(url1.pathname, "/shifts/schedule/paged");
  assert.equal(url1.searchParams.get("startDate"), "2026-10-19");
  assert.equal(url1.searchParams.get("endDate"), "2026-10-25");
  assert.equal(url1.searchParams.get("page"), "0");
  assert.equal(url1.searchParams.get("size"), "20");
  assert.equal(url1.searchParams.has("keyword"), false);

  // 2. Custom page and size
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 2, 50);
  assert.equal(getRequests.length, 2);
  const url2 = new URL(getRequests[1], "http://localhost");
  assert.equal(url2.pathname, "/shifts/schedule/paged");
  assert.equal(url2.searchParams.get("page"), "2");
  assert.equal(url2.searchParams.get("size"), "50");
  assert.equal(url2.searchParams.has("keyword"), false);

  // 3. Keyword provided with standard text
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, "Nguyễn Văn A");
  assert.equal(getRequests.length, 3);
  const url3 = new URL(getRequests[2], "http://localhost");
  assert.equal(url3.pathname, "/shifts/schedule/paged");
  assert.equal(url3.searchParams.get("keyword"), "Nguyễn Văn A");

  // 4. Keyword trimmed when containing leading/trailing whitespace
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 1, 10, "   NV007   ");
  assert.equal(getRequests.length, 4);
  const url4 = new URL(getRequests[3], "http://localhost");
  assert.equal(url4.searchParams.get("keyword"), "NV007");

  // 5. Keyword is empty string -> ignored
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, "");
  assert.equal(getRequests.length, 5);
  const url5 = new URL(getRequests[4], "http://localhost");
  assert.equal(url5.searchParams.has("keyword"), false);

  // 6. Keyword is only spaces -> ignored
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, "     ");
  assert.equal(getRequests.length, 6);
  const url6 = new URL(getRequests[5], "http://localhost");
  assert.equal(url6.searchParams.has("keyword"), false);

  // 7. Keyword is tabs and newlines -> ignored
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, "\t  \r\n  ");
  assert.equal(getRequests.length, 7);
  const url7 = new URL(getRequests[6], "http://localhost");
  assert.equal(url7.searchParams.has("keyword"), false);

  // 8. Keyword is undefined -> ignored
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, undefined);
  assert.equal(getRequests.length, 8);
  const url8 = new URL(getRequests[7], "http://localhost");
  assert.equal(url8.searchParams.has("keyword"), false);

  // 9. Keyword is null -> ignored
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, null);
  assert.equal(getRequests.length, 9);
  const url9 = new URL(getRequests[8], "http://localhost");
  assert.equal(url9.searchParams.has("keyword"), false);

  // 10. Keyword with special characters (&, +, %, #) is properly encoded
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 0, 20, "Lê & Phúc + Dev #2 100%");
  assert.equal(getRequests.length, 10);
  const rawReq10 = getRequests[9];
  assert.ok(rawReq10.includes("%26"), "Special character & must be URL encoded as %26");
  assert.ok(rawReq10.includes("%2B"), "Special character + must be URL encoded as %2B");
  const url10 = new URL(rawReq10, "http://localhost");
  assert.equal(url10.searchParams.get("keyword"), "Lê & Phúc + Dev #2 100%");

  // 11. Large page and size boundaries
  await shiftService.getSchedulePaged("2026-10-19", "2026-10-25", 99, 100);
  assert.equal(getRequests.length, 11);
  const url11 = new URL(getRequests[10], "http://localhost");
  assert.equal(url11.searchParams.get("page"), "99");
  assert.equal(url11.searchParams.get("size"), "100");
});

test("shift schedule source code regression check: no hardcoded .slice(0, 25) and prop forwarding (ST4-01 + ST4-05)", () => {
  const useShiftsSource = readFileSync(
    new URL("../hooks/shifts/use-shifts.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    !useShiftsSource.includes(".slice(0, 25)"),
    "use-shifts.ts must NOT contain hardcoded .slice(0, 25)",
  );

  const scheduleGridSource = readFileSync(
    new URL("../components/shifts/schedule-grid.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    !scheduleGridSource.includes(".slice(0, 25)"),
    "schedule-grid.tsx must NOT contain hardcoded .slice(0, 25)",
  );

  const commonTypesSource = readFileSync(
    new URL("../types/common.types.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    commonTypesSource.includes("totalElement: number"),
    "common.types.ts PageResponse must include totalElement (matching Backend PageResponse.java)",
  );
  assert.ok(
    commonTypesSource.includes("totalElements?: number"),
    "common.types.ts PageResponse must support optional totalElements",
  );

  const shiftTypesSource = readFileSync(
    new URL("../types/shift.types.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    shiftTypesSource.includes("WeeklyScheduleResponse"),
    "shift.types.ts must define WeeklyScheduleResponse",
  );

  const pageSource = readFileSync(
    new URL("../app/(dashboard)/shifts/page.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    pageSource.includes("scheduleKeyword={model.scheduleKeyword}"),
    "shifts/page.tsx must pass scheduleKeyword to ScheduleGrid",
  );
  assert.ok(
    pageSource.includes("handleScheduleKeywordChange={model.handleScheduleKeywordChange}"),
    "shifts/page.tsx must pass handleScheduleKeywordChange to ScheduleGrid",
  );
  assert.ok(
    pageSource.includes("schedulePage={model.schedulePage}"),
    "shifts/page.tsx must pass schedulePage to ScheduleGrid",
  );
  assert.ok(
    pageSource.includes("scheduleTotalPages={model.scheduleTotalPages}"),
    "shifts/page.tsx must pass scheduleTotalPages to ScheduleGrid",
  );
  assert.ok(
    pageSource.includes("scheduleTotalElements={model.scheduleTotalElements}"),
    "shifts/page.tsx must pass scheduleTotalElements to ScheduleGrid",
  );
  assert.ok(
    pageSource.includes("setSchedulePage={model.setSchedulePage}"),
    "shifts/page.tsx must pass setSchedulePage to ScheduleGrid",
  );
});

function createShiftReactHarness() {
  let states = [];
  let stateCursor = 0;
  let effects = [];
  let effectCursor = 0;
  let callbacks = [];
  let callbackCursor = 0;
  let memos = [];
  let memoCursor = 0;
  let refs = [];
  let refCursor = 0;
  let isRendering = false;
  let isBatching = false;
  let pendingRender = false;
  let renderFn = null;
  let latestResult = null;

  function shallowEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function batch(fn) {
    const prev = isBatching;
    isBatching = true;
    try {
      return fn();
    } finally {
      isBatching = prev;
      if (!isBatching && pendingRender) {
        pendingRender = false;
        doRender();
      }
    }
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
      const wrapped = (...args) => batch(() => fn(...args));
      if (callbacks.length <= idx) {
        callbacks.push({ fn, wrapped, deps });
        return wrapped;
      }
      const slot = callbacks[idx];
      if (deps && shallowEqual(slot.deps, deps)) {
        return slot.wrapped;
      }
      callbacks[idx] = { fn, wrapped, deps };
      return wrapped;
    },
    useMemo(fn, deps) {
      const idx = memoCursor++;
      if (memos.length <= idx) {
        const val = fn();
        memos.push({ val, deps });
        return val;
      }
      const slot = memos[idx];
      if (deps && shallowEqual(slot.deps, deps)) {
        return slot.val;
      }
      const val = fn();
      memos[idx] = { val, deps };
      return val;
    },
    useRef(val) {
      const idx = refCursor++;
      if (refs.length <= idx) {
        refs.push({ current: val });
      }
      return refs[idx];
    },
    useEffect(fn, deps) {
      const idx = effectCursor++;
      if (effects.length <= idx) {
        effects.push({ fn, deps, cleanup: null, run: true });
        return;
      }
      const slot = effects[idx];
      if (!deps || !shallowEqual(slot.deps, deps)) {
        slot.fn = fn;
        slot.deps = deps;
        slot.run = true;
      }
    },
  };

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
        memoCursor = 0;
        refCursor = 0;
        latestResult = renderFn();
        for (const slot of effects) {
          if (slot.run) {
            slot.run = false;
            if (typeof slot.cleanup === "function") {
              slot.cleanup();
            }
            slot.cleanup = slot.fn();
          }
        }
      } while (pendingRender);
    } finally {
      isRendering = false;
    }
  }

  function scheduleRender() {
    if (isRendering || isBatching) {
      pendingRender = true;
      return;
    }
    if (renderFn) doRender();
  }

  const wrappedSetTimeout = (fn, ms) => {
    return setTimeout(() => batch(fn), ms);
  };

  return {
    mockReact,
    batch,
    setTimeout: wrappedSetTimeout,
    render(hook) {
      renderFn = hook;
      doRender();
      return latestResult;
    },
    getResult: () => latestResult,
    flush: async (ms = 20) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      doRender();
    },
    unmount() {
      for (const slot of effects) {
        if (typeof slot.cleanup === "function") {
          slot.cleanup();
          slot.cleanup = null;
        }
      }
    },
  };
}

test("useShifts hook: no slice(0, 25), totalElement/totalElements compatibility, keyword debounce, call recording, and page resets (ST4-01 + ST4-05)", async () => {
  const harness = createShiftReactHarness();
  const helpers = loadTs("lib/shifts-helpers.ts");
  const errors = loadTs("lib/errors.ts");
  const { useLatestRequest } = loadTs(
    "hooks/use-latest-request.ts",
    {},
    { react: harness.mockReact },
  );

  let pagedCalls = [];
  const mockEmployees30 = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    fullName: `Nhân viên ${i + 1}`,
    employeeCode: `NV${String(i + 1).padStart(3, "0")}`,
    status: i === 24 ? "INACTIVE" : "ACTIVE", // Employee 25 is inactive
  }));

  let currentPagedData = {
    employees: {
      content: mockEmployees30,
      pageNumber: 0,
      pageSize: 20,
      totalElement: 45,
      totalPages: 3,
      last: false,
    },
    assignments: [
      {
        id: 101,
        userId: 1,
        employeeCode: "NV001",
        fullName: "Nhân viên 1",
        shiftId: 1,
        shiftName: "Ca Sáng",
        shiftCode: "MORNING",
        startTime: "08:00:00",
        endTime: "16:00:00",
        assignedDate: "2026-10-19",
      },
    ],
  };

  const shiftServiceMock = {
    getAll: async () => ({ status: "SUCCESS", data: [] }),
    getSchedulePaged: async (...args) => {
      pagedCalls.push(args);
      return { status: "SUCCESS", data: currentPagedData };
    },
  };

  const stableToast = { error: () => {}, success: () => {} };

  const { useShifts } = loadTs(
    "hooks/shifts/use-shifts.ts",
    { setTimeout: harness.setTimeout, clearTimeout },
    {
      react: harness.mockReact,
      "@/components/ui/toast": { useToast: () => stableToast },
      "@/hooks/shifts/use-bulk-assignment": { useBulkAssignment: () => ({}) },
      "@/hooks/shifts/use-copy-week": { useCopyWeek: () => ({}) },
      "@/hooks/shifts/use-shift-catalog": { useShiftCatalog: () => ({}) },
      "@/hooks/use-latest-request": { useLatestRequest },
      "@/lib/errors": errors,
      "@/lib/shifts-helpers": helpers,
      "@/services/employee.service": {
        employeeService: {
          getAll: async () => ({ status: "SUCCESS", data: { content: [] } }),
        },
      },
      "@/services/shift.service": { shiftService: shiftServiceMock },
    },
  );

  harness.render(() => useShifts());
  await harness.flush(50);
  let res = harness.getResult();

  const startWeekDate = helpers.toISODate(res.weekDays[0]);
  const endWeekDate = helpers.toISODate(res.weekDays[6]);

  // 1. Initial call recorded properly
  assert.equal(pagedCalls.length, 1, "Initial render must invoke getSchedulePaged once");
  assert.deepEqual(
    pagedCalls[0],
    [startWeekDate, endWeekDate, 0, 20, ""],
    "Initial call must use default page 0, size 20, and empty keyword",
  );

  // 2. Verify no .slice(0, 25): all 30 employees from server page are present in displayEmployees
  assert.equal(
    res.displayEmployees.length,
    30,
    "displayEmployees must contain all 30 employees without hardcoded .slice(0, 25)",
  );

  // 3. Verify totalElement (Backend PageResponse.java) compatibility
  assert.equal(
    res.scheduleTotalElements,
    45,
    "scheduleTotalElements must take totalElement from backend PageResponse",
  );
  assert.equal(res.scheduleTotalPages, 3, "scheduleTotalPages must match totalPages");

  // 4. Verify totalElements fallback when totalElement is undefined
  currentPagedData = {
    employees: {
      content: mockEmployees30.slice(0, 20),
      pageNumber: 1,
      pageSize: 20,
      totalElement: undefined,
      totalElements: 60,
      totalPages: 3,
      last: false,
    },
    assignments: [],
  };
  // Trigger refetch by changing page
  res.setSchedulePage(1);
  await harness.flush(50);
  res = harness.getResult();
  assert.equal(
    res.scheduleTotalElements,
    60,
    "scheduleTotalElements must fallback to totalElements when totalElement is undefined",
  );
  assert.equal(pagedCalls.length, 2, "Changing page must trigger second getSchedulePaged call");
  assert.deepEqual(
    pagedCalls[1],
    [startWeekDate, endWeekDate, 1, 20, ""],
    "Second call must request page 1",
  );

  // 5. Verify 300ms debounce for scheduleKeyword
  res.handleScheduleKeywordChange("Nguyễn");
  res = harness.getResult();
  assert.equal(res.scheduleKeyword, "Nguyễn", "scheduleKeyword updates immediately");
  assert.equal(
    res.debouncedScheduleKeyword,
    "",
    "debouncedScheduleKeyword must NOT update immediately before 300ms",
  );
  assert.equal(pagedCalls.length, 2, "No fetch before debounce completes");

  await harness.flush(100);
  res = harness.getResult();
  assert.equal(
    res.debouncedScheduleKeyword,
    "",
    "debouncedScheduleKeyword must still be empty after 100ms",
  );
  assert.equal(pagedCalls.length, 2);

  await harness.flush(250);
  res = harness.getResult();
  assert.equal(
    res.debouncedScheduleKeyword,
    "Nguyễn",
    "debouncedScheduleKeyword must update after 300ms debounce window",
  );
  assert.equal(pagedCalls.length, 3, "getSchedulePaged must be called after debounce");
  assert.deepEqual(
    pagedCalls[2],
    [startWeekDate, endWeekDate, 0, 20, "Nguyễn"],
    "Call with debounced keyword must reset page to 0",
  );

  // 6. Verify rapid keystrokes cancellation
  res.handleScheduleKeywordChange("H");
  await harness.flush(100);
  res.handleScheduleKeywordChange("Ho");
  await harness.flush(100);
  res.handleScheduleKeywordChange("Hoàng");
  await harness.flush(200); // 200ms since last keystroke (less than 300ms)
  res = harness.getResult();
  assert.equal(
    res.debouncedScheduleKeyword,
    "Nguyễn",
    "debouncedScheduleKeyword must not update to intermediate rapid keystrokes before 300ms from last stroke",
  );
  await harness.flush(150); // Now 350ms since 'Hoàng'
  res = harness.getResult();
  assert.equal(
    res.debouncedScheduleKeyword,
    "Hoàng",
    "debouncedScheduleKeyword must update to final keystroke after 300ms inactivity",
  );

  // 7. Verify keyword change resets schedulePage = 0 when on page > 0
  res.setSchedulePage(2);
  res = harness.getResult();
  assert.equal(res.schedulePage, 2);
  res.handleScheduleKeywordChange("Trần");
  res = harness.getResult();
  assert.equal(res.schedulePage, 2, "schedulePage remains 2 before debounce triggers");
  await harness.flush(350);
  res = harness.getResult();
  assert.equal(
    res.schedulePage,
    0,
    "Changing keyword must reset schedulePage to 0 after debounce",
  );
  assert.equal(res.debouncedScheduleKeyword, "Trần");

  // 8. Verify week change (handleSetWeekStart) resets schedulePage = 0
  res.setSchedulePage(2);
  res = harness.getResult();
  assert.equal(res.schedulePage, 2);
  const nextMonday = helpers.addDays(res.weekDays[0], 7);
  res.setWeekStart(nextMonday);
  res = harness.getResult();
  assert.equal(
    res.schedulePage,
    0,
    "handleSetWeekStart must reset schedulePage to 0",
  );
  await harness.flush(50);
  const newStart = helpers.toISODate(nextMonday);
  const newEnd = helpers.toISODate(helpers.addDays(nextMonday, 6));
  assert.equal(
    pagedCalls.at(-1)[0],
    newStart,
    "fetchSchedule after week change must use new week start",
  );
  assert.equal(
    pagedCalls.at(-1)[1],
    newEnd,
    "fetchSchedule after week change must use new week end",
  );
  assert.equal(
    pagedCalls.at(-1)[2],
    0,
    "fetchSchedule after week change must use page 0",
  );

  // 9. Verify keyword clear immediately resets schedulePage = 0 and debouncedScheduleKeyword
  res.setSchedulePage(2);
  res = harness.getResult();
  assert.equal(res.schedulePage, 2);
  res.handleScheduleKeywordChange("");
  res = harness.getResult();
  assert.equal(
    res.schedulePage,
    0,
    "Clearing keyword must immediately reset schedulePage to 0 without waiting for debounce",
  );
  assert.equal(
    res.debouncedScheduleKeyword,
    "",
    "Clearing keyword must immediately reset debouncedScheduleKeyword to empty string",
  );
  await harness.flush(50);
  assert.equal(pagedCalls.at(-1)[4], "", "Latest fetch must have empty keyword");

  // 10. Verify out-of-range schedulePage reset
  currentPagedData = {
    employees: {
      content: [mockEmployees30[0]],
      pageNumber: 0,
      pageSize: 20,
      totalElement: 1,
      totalPages: 1,
      last: true,
    },
    assignments: [],
  };
  res.setSchedulePage(2);
  await harness.flush(50);
  res = harness.getResult();
  assert.equal(
    res.schedulePage,
    0,
    "When schedulePage exceeds totalPages, hook must reset schedulePage to 0",
  );

  // 11. Verify AssignShiftDialog integration: clicking cell on employee 25 ensures employee is in activeEmployees
  currentPagedData = {
    employees: {
      content: mockEmployees30,
      pageNumber: 0,
      pageSize: 20,
      totalElement: 45,
      totalPages: 3,
      last: false,
    },
    assignments: [],
  };
  res.setWeekStart(new Date());
  await harness.flush(50);
  res = harness.getResult();

  const emp25 = mockEmployees30[24]; // status: "INACTIVE", id: 25
  res.handleCellClick(emp25, new Date("2026-10-20"));
  res = harness.getResult();
  assert.equal(res.isAssignOpen, true, "handleCellClick must open assign shift dialog");
  assert.equal(res.assignForm.userId, "25", "assignForm.userId must be set to employee id");
  assert.equal(res.assignForm.assignedDate, "2026-10-20", "assignForm.assignedDate must match clicked date");
  assert.ok(
    res.activeEmployees.some((e) => e.id === 25),
    "activeEmployees must include clicked employee from paged list so AssignShiftDialog dropdown has selected option",
  );
});

test("useShifts hook: error handling, race condition defense, and legacy fallback (ST4-01 + ST4-05)", async () => {
  const helpers = loadTs("lib/shifts-helpers.ts");
  const errors = loadTs("lib/errors.ts");
  const stableToast = { error: () => {}, success: () => {} };

  // --- Part A: Error Handling (Network failure and HTTP Error response) ---
  const harnessError = createShiftReactHarness();
  const { useLatestRequest: useLatestRequestError } = loadTs(
    "hooks/use-latest-request.ts",
    {},
    { react: harnessError.mockReact },
  );

  let shouldThrow = true;
  const shiftServiceErrorMock = {
    getAll: async () => ({ status: "SUCCESS", data: [] }),
    getSchedulePaged: async () => {
      if (shouldThrow) {
        throw new Error("Mất kết nối máy chủ");
      }
      return { status: "ERROR", message: "Internal server error" };
    },
  };

  const { useShifts: useShiftsError } = loadTs(
    "hooks/shifts/use-shifts.ts",
    { setTimeout: harnessError.setTimeout, clearTimeout },
    {
      react: harnessError.mockReact,
      "@/components/ui/toast": { useToast: () => stableToast },
      "@/hooks/shifts/use-bulk-assignment": { useBulkAssignment: () => ({}) },
      "@/hooks/shifts/use-copy-week": { useCopyWeek: () => ({}) },
      "@/hooks/shifts/use-shift-catalog": { useShiftCatalog: () => ({}) },
      "@/hooks/use-latest-request": { useLatestRequest: useLatestRequestError },
      "@/lib/errors": errors,
      "@/lib/shifts-helpers": helpers,
      "@/services/employee.service": {
        employeeService: {
          getAll: async () => ({ status: "SUCCESS", data: { content: [] } }),
        },
      },
      "@/services/shift.service": { shiftService: shiftServiceErrorMock },
    },
  );

  harnessError.render(() => useShiftsError());
  await harnessError.flush(50);
  let resErr = harnessError.getResult();
  assert.equal(resErr.isLoadingSchedule, false, "isLoadingSchedule must be false on network throw");
  assert.equal(resErr.displayEmployees.length, 0, "displayEmployees must be empty on network throw");
  assert.equal(resErr.scheduleTotalPages, 0);
  assert.equal(resErr.scheduleTotalElements, 0);

  // Test error status response (without throw)
  shouldThrow = false;
  resErr.setSchedulePage(1);
  await harnessError.flush(50);
  resErr = harnessError.getResult();
  assert.equal(resErr.isLoadingSchedule, false, "isLoadingSchedule must be false on error status");
  assert.equal(resErr.displayEmployees.length, 0);
  assert.equal(resErr.scheduleTotalPages, 0);
  assert.equal(resErr.scheduleTotalElements, 0);

  // --- Part B: Race condition defense with real useLatestRequest ---
  const harnessRace = createShiftReactHarness();
  const { useLatestRequest: useLatestRequestRace } = loadTs(
    "hooks/use-latest-request.ts",
    {},
    { react: harnessRace.mockReact },
  );

  let resolvers = [];
  const shiftServiceRaceMock = {
    getAll: async () => ({ status: "SUCCESS", data: [] }),
    getSchedulePaged: async (...args) => {
      return new Promise((resolve) => {
        resolvers.push({ args, resolve });
      });
    },
  };

  const { useShifts: useShiftsRace } = loadTs(
    "hooks/shifts/use-shifts.ts",
    { setTimeout: harnessRace.setTimeout, clearTimeout },
    {
      react: harnessRace.mockReact,
      "@/components/ui/toast": { useToast: () => stableToast },
      "@/hooks/shifts/use-bulk-assignment": { useBulkAssignment: () => ({}) },
      "@/hooks/shifts/use-copy-week": { useCopyWeek: () => ({}) },
      "@/hooks/shifts/use-shift-catalog": { useShiftCatalog: () => ({}) },
      "@/hooks/use-latest-request": { useLatestRequest: useLatestRequestRace },
      "@/lib/errors": errors,
      "@/lib/shifts-helpers": helpers,
      "@/services/employee.service": {
        employeeService: {
          getAll: async () => ({ status: "SUCCESS", data: { content: [] } }),
        },
      },
      "@/services/shift.service": { shiftService: shiftServiceRaceMock },
    },
  );

  harnessRace.render(() => useShiftsRace());
  await harnessRace.flush(20);
  assert.equal(resolvers.length, 1, "Initial request (req 0 for page 0) is pending");

  // User quickly switches to page 1 while req 0 is still in flight
  let resRace = harnessRace.getResult();
  resRace.setSchedulePage(1);
  await harnessRace.flush(20);
  assert.equal(resolvers.length, 2, "Second request (req 1 for page 1) is now pending");

  // Req 1 (page 1) completes FAST
  resolvers[1].resolve({
    status: "SUCCESS",
    data: {
      employees: {
        content: [{ id: 99, fullName: "Page 1 Fast Employee", employeeCode: "NV099", status: "ACTIVE" }],
        pageNumber: 1,
        pageSize: 20,
        totalElement: 100,
        totalPages: 5,
        last: false,
      },
      assignments: [],
    },
  });
  await harnessRace.flush(20);
  resRace = harnessRace.getResult();
  assert.equal(resRace.displayEmployees[0].fullName, "Page 1 Fast Employee");

  // Req 0 (page 0) completes SLOWLY after req 1
  resolvers[0].resolve({
    status: "SUCCESS",
    data: {
      employees: {
        content: [{ id: 1, fullName: "Stale Page 0 Employee", employeeCode: "NV001", status: "ACTIVE" }],
        pageNumber: 0,
        pageSize: 20,
        totalElement: 100,
        totalPages: 5,
        last: false,
      },
      assignments: [],
    },
  });
  await harnessRace.flush(20);
  resRace = harnessRace.getResult();
  assert.equal(
    resRace.displayEmployees[0].fullName,
    "Page 1 Fast Employee",
    "Stale page 0 response must be discarded by useLatestRequest and not overwrite page 1 data",
  );

  // --- Part C: Legacy fallback mode (when getSchedulePaged is undefined) ---
  const harnessFallback = createShiftReactHarness();
  const { useLatestRequest: useLatestRequestFallback } = loadTs(
    "hooks/use-latest-request.ts",
    {},
    { react: harnessFallback.mockReact },
  );

  const fallbackEmployees = [
    { id: 10, fullName: "Cường", employeeCode: "NV010", status: "ACTIVE" },
    { id: 20, fullName: "An", employeeCode: "NV020", status: "ACTIVE" },
    { id: 30, fullName: "Bình", employeeCode: "NV030", status: "ACTIVE" },
  ];

  const shiftServiceFallbackMock = {
    getAll: async () => ({ status: "SUCCESS", data: [] }),
    getSchedule: async () => ({
      status: "SUCCESS",
      data: [
        {
          id: 501,
          userId: 30, // Bình has assignment this week
          employeeCode: "NV030",
          fullName: "Bình",
          shiftId: 1,
          shiftName: "Ca Chiều",
          assignedDate: "2026-10-19",
        },
      ],
    }),
  };

  const { useShifts: useShiftsFallback } = loadTs(
    "hooks/shifts/use-shifts.ts",
    { setTimeout: harnessFallback.setTimeout, clearTimeout },
    {
      react: harnessFallback.mockReact,
      "@/components/ui/toast": { useToast: () => stableToast },
      "@/hooks/shifts/use-bulk-assignment": { useBulkAssignment: () => ({}) },
      "@/hooks/shifts/use-copy-week": { useCopyWeek: () => ({}) },
      "@/hooks/shifts/use-shift-catalog": { useShiftCatalog: () => ({}) },
      "@/hooks/use-latest-request": { useLatestRequest: useLatestRequestFallback },
      "@/lib/errors": errors,
      "@/lib/shifts-helpers": helpers,
      "@/services/employee.service": {
        employeeService: {
          getAll: async () => ({ status: "SUCCESS", data: { content: fallbackEmployees } }),
        },
      },
      "@/services/shift.service": { shiftService: shiftServiceFallbackMock },
    },
  );

  harnessFallback.render(() => useShiftsFallback());
  await harnessFallback.flush(50);
  let resFb = harnessFallback.getResult();

  // In fallback: employee with shift (Bình) must be sorted first, then alphabetical (An, Cường)
  assert.equal(resFb.displayEmployees.length, 3);
  assert.equal(resFb.displayEmployees[0].fullName, "Bình", "Employee with assignment must be first");
  assert.equal(resFb.displayEmployees[1].fullName, "An");
  assert.equal(resFb.displayEmployees[2].fullName, "Cường");
  assert.equal(resFb.scheduleTotalElements, 3);
  assert.equal(resFb.scheduleTotalPages, 1);

  // Test keyword search in fallback
  resFb.handleScheduleKeywordChange("An");
  await harnessFallback.flush(350);
  resFb = harnessFallback.getResult();
  assert.equal(resFb.displayEmployees.length, 1);
  assert.equal(resFb.displayEmployees[0].fullName, "An");
});

test("ScheduleGrid renders staff search input, total staff count, pagination bar, loading skeleton, and handles interactions (ST4-01 + ST4-05)", () => {
  const helpers = loadTs("lib/shifts-helpers.ts");
  const { ScheduleGrid } = loadTs(
    "components/shifts/schedule-grid.tsx",
    {},
    {
      "react/jsx-runtime": sharedJsxRuntime,
      "@/components/ui/button": {
        Button: (props) => ({ type: "button", props }),
      },
      "@/components/ui/card": {
        Card: (props) => ({ type: "card", props }),
        CardHeader: (props) => ({ type: "card-header", props }),
        CardTitle: (props) => ({ type: "card-title", props }),
        CardContent: (props) => ({ type: "card-content", props }),
      },
      "@/components/ui/pagination": {
        Pagination: (props) => ({ type: "pagination", props }),
      },
      "@/lib/shifts-helpers": helpers,
      "lucide-react": new Proxy({}, { get: () => dummyIcon }),
    },
  );

  const mockEmployees = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    fullName: `Nhân viên ${i + 1}`,
    employeeCode: `NV${String(i + 1).padStart(3, "0")}`,
    status: "ACTIVE",
  }));

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    helpers.addDays(helpers.getMondayOfWeek(new Date("2026-10-19")), i),
  );

  let keywordUpdated = null;
  let pageUpdated = null;
  let cellClickedData = null;
  let removeConfirmedData = null;

  const mockScheduleMap = new Map();
  // Assign shift for employee 1 on first day (2026-10-19)
  const mondayStr = helpers.toISODate(weekDays[0]);
  mockScheduleMap.set(`1_${mondayStr}`, {
    id: 901,
    userId: 1,
    employeeCode: "NV001",
    fullName: "Nhân viên 1",
    shiftId: 5,
    shiftName: "Ca Sáng",
    shiftCode: "MORNING",
    startTime: "08:00:00",
    endTime: "16:00:00",
    assignedDate: mondayStr,
  });

  const mockShiftColorMap = new Map([
    [
      5,
      {
        bg: "bg-amber-50",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        text: "text-amber-800",
      },
    ],
  ]);

  const defaultProps = {
    weekLabel: "19/10 – 25/10/2026",
    setWeekStart: () => {},
    weekDays,
    today: "2026-10-20",
    isLoadingSchedule: false,
    displayEmployees: mockEmployees,
    scheduleMap: mockScheduleMap,
    shiftColorMap: mockShiftColorMap,
    handleCellClick: (emp, day, entry) => {
      cellClickedData = { emp, day, entry };
    },
    setConfirmRemove: (data) => {
      removeConfirmedData = data;
    },
    scheduleKeyword: "NV001",
    handleScheduleKeywordChange: (val) => {
      keywordUpdated = val;
    },
    schedulePage: 1,
    scheduleTotalPages: 3,
    scheduleTotalElements: 55,
    setSchedulePage: (p) => {
      pageUpdated = p;
    },
  };

  const vdom = ScheduleGrid(defaultProps);

  // 1. Search input rendered with correct attributes
  const searchInputs = findNodes(
    vdom,
    (n) => n.type === "input" && n.props?.["aria-label"] === "Tìm kiếm nhân viên",
  );
  assert.equal(searchInputs.length, 1, "Must render exactly 1 staff search input");
  assert.equal(
    searchInputs[0].props.placeholder,
    "Tìm tên hoặc mã nhân viên...",
  );
  assert.equal(searchInputs[0].props.value, "NV001");

  // Simulate typing in search input
  searchInputs[0].props.onChange({ target: { value: "NV002" } });
  assert.equal(
    keywordUpdated,
    "NV002",
    "Typing in search input must call handleScheduleKeywordChange",
  );

  // 2. Clear button (X) visible when keyword is non-empty
  const clearButtons = findNodes(
    vdom,
    (n) => n.type === "button" && n.props?.title === "Xóa từ khóa",
  );
  assert.equal(clearButtons.length, 1, "Must render clear button when keyword is present");
  clearButtons[0].props.onClick();
  assert.equal(
    keywordUpdated,
    "",
    "Clicking clear button must call handleScheduleKeywordChange with empty string",
  );

  // 3. Clear button NOT rendered when keyword is empty
  const vdomEmptyKeyword = ScheduleGrid({
    ...defaultProps,
    scheduleKeyword: "",
  });
  const clearButtonsEmpty = findNodes(
    vdomEmptyKeyword,
    (n) => n.type === "button" && n.props?.title === "Xóa từ khóa",
  );
  assert.equal(
    clearButtonsEmpty.length,
    0,
    "Must NOT render clear button when keyword is empty",
  );

  // 4. Total employees count display ("Tổng số: ... nhân viên")
  const totalSpans = findNodes(
    vdom,
    (n) => n.type === "span" && n.props?.children === 55,
  );
  assert.equal(totalSpans.length, 1, "Must render span with 55");
  const totalDivs = findNodes(
    vdom,
    (n) => n.type === "div" && n.props?.className?.includes("text-xs") && n.props?.children?.[0] === "Tổng số:",
  );
  assert.equal(totalDivs.length, 1, "Must render container with 'Tổng số:'");
  assert.equal(totalDivs[0].props.children[0], "Tổng số:");
  assert.equal(totalDivs[0].props.children[2].props.children, 55);
  assert.equal(totalDivs[0].props.children[4], "nhân viên");

  // Test zero elements total display
  const vdomZeroTotal = ScheduleGrid({
    ...defaultProps,
    scheduleTotalElements: 0,
  });
  const zeroSpans = findNodes(
    vdomZeroTotal,
    (n) => n.type === "span" && n.props?.children === 0,
  );
  assert.equal(zeroSpans.length, 1, "Must render span with 0");
  const zeroTotalDivs = findNodes(
    vdomZeroTotal,
    (n) => n.type === "div" && n.props?.className?.includes("text-xs") && n.props?.children?.[0] === "Tổng số:",
  );
  assert.equal(zeroTotalDivs.length, 1);
  assert.equal(zeroTotalDivs[0].props.children[0], "Tổng số:");
  assert.equal(zeroTotalDivs[0].props.children[2].props.children, 0);
  assert.equal(zeroTotalDivs[0].props.children[4], "nhân viên");

  // 5. Pagination component rendered when totalPages > 1
  const paginations = findNodes(vdom, (n) => n.type === "pagination");
  assert.equal(
    paginations.length,
    1,
    "Must render <Pagination /> when scheduleTotalPages > 1",
  );
  assert.equal(paginations[0].props.pageNumber, 1);
  assert.equal(paginations[0].props.totalPages, 3);

  paginations[0].props.onPageChange(2);
  assert.equal(
    pageUpdated,
    2,
    "Changing page in <Pagination /> must call setSchedulePage",
  );

  // 6. Pagination NOT rendered when totalPages <= 1
  const vdomSinglePage = ScheduleGrid({
    ...defaultProps,
    scheduleTotalPages: 1,
  });
  assert.equal(
    findNodes(vdomSinglePage, (n) => n.type === "pagination").length,
    0,
    "Must NOT render <Pagination /> when scheduleTotalPages is 1",
  );

  const vdomZeroPage = ScheduleGrid({
    ...defaultProps,
    scheduleTotalPages: 0,
  });
  assert.equal(
    findNodes(vdomZeroPage, (n) => n.type === "pagination").length,
    0,
    "Must NOT render <Pagination /> when scheduleTotalPages is 0",
  );

  // 7. No .slice(0, 25): all 30 employee rows are rendered
  const employeeRows = findNodes(
    vdom,
    (n) => n.type === "tr" && n.props?.className?.includes("hover:bg-slate-50/80"),
  );
  assert.equal(
    employeeRows.length,
    30,
    "Must render all 30 employee rows without 25 cap",
  );

  // 8. Empty search results message
  const vdomEmptySearch = ScheduleGrid({
    ...defaultProps,
    displayEmployees: [],
    scheduleKeyword: "Không tồn tại",
  });
  const emptySearchP = findNodes(
    vdomEmptySearch,
    (n) =>
      n.type === "p" &&
      n.props?.children === "Không tìm thấy nhân viên nào phù hợp với từ khóa tìm kiếm.",
  );
  assert.equal(
    emptySearchP.length,
    1,
    "Must display search-specific empty state message when keyword is present",
  );

  // 9. Empty schedule message (no keyword)
  const vdomEmptyNoSearch = ScheduleGrid({
    ...defaultProps,
    displayEmployees: [],
    scheduleKeyword: "",
  });
  const emptyNoSearchP = findNodes(
    vdomEmptyNoSearch,
    (n) => n.type === "p" && n.props?.children === "Chưa có nhân viên nào.",
  );
  assert.equal(
    emptyNoSearchP.length,
    1,
    "Must display generic empty state message when keyword is empty",
  );

  // 10. Loading skeleton state (isLoadingSchedule = true)
  const vdomLoading = ScheduleGrid({
    ...defaultProps,
    isLoadingSchedule: true,
  });
  const skeletonRows = findNodes(
    vdomLoading,
    (n) => n.type === "tr" && n.props?.className?.includes("border-border"),
  );
  assert.equal(skeletonRows.length, 4, "Must render 4 skeleton rows when isLoadingSchedule is true");
  const skeletonCells = findNodes(
    vdomLoading,
    (n) => typeof n?.props?.className === "string" && n.props.className.includes("animate-pulse"),
  );
  assert.ok(skeletonCells.length > 0, "Skeleton rows must contain animate-pulse elements");
  assert.equal(
    findNodes(vdomLoading, (n) => n.type === "tr" && n.props?.className?.includes("hover:bg-slate-50/80")).length,
    0,
    "Must not render employee rows while loading",
  );

  // 11. Interactive cells: empty cell click and assigned cell buttons
  // Find empty cell for employee 1 on Tuesday (index 1)
  const emp1Cells = findNodes(employeeRows[0], (n) => n.type === "td");
  // Index 0 is employee name, index 1 is Monday (assigned), index 2 is Tuesday (empty)
  const emptyCell = emp1Cells[2];
  assert.ok(emptyCell, "Empty cell on Tuesday must exist");
  emptyCell.props.onClick();
  assert.ok(cellClickedData, "Clicking empty cell must trigger handleCellClick");
  assert.equal(cellClickedData.emp.id, 1);
  assert.equal(helpers.toISODate(cellClickedData.day), helpers.toISODate(weekDays[1]));

  // Assigned cell (Monday, index 1)
  const assignedCell = emp1Cells[1];
  const assignedText = findNodes(assignedCell, (c) => typeof c === "string").join(" ");
  assert.ok(
    assignedText.includes("08:00") && assignedText.includes("16:00"),
    "Assigned cell must show shift hours",
  );

  // "Đổi" button in assigned cell
  const editShiftBtn = findNodes(assignedCell, (n) => n.type === "button" && n.props?.title === "Đổi ca")[0];
  assert.ok(editShiftBtn, "Edit shift button must be present in assigned cell");
  let stopPropagated = false;
  cellClickedData = null;
  editShiftBtn.props.onClick({ stopPropagation: () => { stopPropagated = true; } });
  assert.ok(stopPropagated, "Clicking edit shift button must stop propagation");
  assert.equal(cellClickedData.emp.id, 1);
  assert.equal(helpers.toISODate(cellClickedData.day), mondayStr);

  // "Hủy" button in assigned cell
  const removeShiftBtn = findNodes(assignedCell, (n) => n.type === "button" && n.props?.title === "Hủy ca")[0];
  assert.ok(removeShiftBtn, "Remove shift button must be present in assigned cell");
  removeShiftBtn.props.onClick({ stopPropagation: () => {} });
  assert.ok(removeConfirmedData, "Clicking remove button must call setConfirmRemove");
  assert.equal(removeConfirmedData.userId, 1);
  assert.equal(removeConfirmedData.shiftName, "Ca Sáng");
  assert.equal(removeConfirmedData.date, mondayStr);
});

test("ShiftsPage integrates useShifts with RoleGuard and wires all pagination & search props to ScheduleGrid (ST4-01 + ST4-05)", () => {
  let capturedScheduleGridProps = null;
  let keywordChangedTo = null;
  let pageChangedTo = null;

  const mockModel = {
    shifts: [],
    includeInactive: false,
    setIncludeInactive: () => {},
    handleOpenEdit: () => {},
    handleOpenDelete: () => {},
    weekLabel: "19/10 – 25/10/2026",
    setWeekStart: () => {},
    weekDays: [],
    today: "2026-10-20",
    isLoadingSchedule: false,
    displayEmployees: [{ id: 1, fullName: "Nhân viên 1", employeeCode: "NV001", status: "ACTIVE" }],
    scheduleMap: new Map(),
    shiftColorMap: new Map(),
    handleCellClick: () => {},
    setConfirmRemove: () => {},
    scheduleKeyword: "NV005",
    handleScheduleKeywordChange: (val) => { keywordChangedTo = val; },
    schedulePage: 2,
    scheduleTotalPages: 4,
    scheduleTotalElements: 75,
    setSchedulePage: (p) => { pageChangedTo = p; },
    // Dialog props
    handleOpenCopyWeek: () => {},
    handleOpenBulk: () => {},
    setIsAssignOpen: () => {},
    setIsCreateOpen: () => {},
    isCreateOpen: false,
    handleCreateSubmit: () => {},
    createForm: {},
    setCreateForm: () => {},
    isCreating: false,
    isEditOpen: false,
    setIsEditOpen: () => {},
    handleEditSubmit: () => {},
    editForm: {},
    setEditForm: () => {},
    isUpdating: false,
    isDeleteShiftOpen: false,
    setIsDeleteShiftOpen: () => {},
    deletingShift: null,
    handleDeleteShiftSubmit: () => {},
    replaceShiftId: "",
    setReplaceShiftId: () => {},
    isDeletingShift: false,
    isAssignOpen: false,
    setOverwriteWarning: () => {},
    handleAssignSubmit: () => {},
    assignForm: {},
    setAssignForm: () => {},
    activeEmployees: [],
    activeShiftsForAssign: [],
    overwriteWarning: null,
    isAssigning: false,
    isBulkOpen: false,
    bulkForm: {},
    setBulkForm: () => {},
    setBulkResult: () => {},
    toggleBulkDay: () => {},
    toggleBulkUser: () => {},
    bulkResult: null,
    isBulkPreviewing: false,
    executeBulkAssign: () => {},
    isBulkSubmitting: false,
    isCopyWeekOpen: false,
    copyWeekForm: {},
    setCopyWeekForm: () => {},
    setCopyResult: () => {},
    copyResult: null,
    isCopyPreviewing: false,
    executeCopyWeek: () => {},
    isCopySubmitting: false,
    confirmRemove: null,
    isRemoving: false,
    handleRemoveShift: () => {},
  };

  const pageModule = loadTs(
    "app/(dashboard)/shifts/page.tsx",
    {},
    {
      "react/jsx-runtime": sharedJsxRuntime,
      "@/components/shared/role-guard": {
        RoleGuard: ({ allowedRoles, fallback, children }) => ({
          type: "role-guard",
          props: { allowedRoles, fallback, children },
        }),
      },
      "@/components/shifts/schedule-grid": {
        ScheduleGrid: (props) => {
          capturedScheduleGridProps = props;
          return { type: "schedule-grid", props };
        },
      },
      "@/hooks/shifts/use-shifts": {
        useShifts: () => mockModel,
      },
      "@/components/shifts/shift-toolbar": { ShiftToolbar: () => null },
      "@/components/shifts/shift-catalog": { ShiftCatalog: () => null },
      "@/components/shifts/shift-create-dialog": { ShiftCreateDialog: () => null },
      "@/components/shifts/shift-edit-dialog": { ShiftEditDialog: () => null },
      "@/components/shifts/shift-delete-dialog": { ShiftDeleteDialog: () => null },
      "@/components/shifts/assign-shift-dialog": { AssignShiftDialog: () => null },
      "@/components/shifts/bulk-assign-dialog": { BulkAssignDialog: () => null },
      "@/components/shifts/copy-week-dialog": { CopyWeekDialog: () => null },
      "@/components/shifts/remove-assignment-dialog": { RemoveAssignmentDialog: () => null },
    },
  );

  const ShiftsPage = pageModule.default;
  const vdom = ShiftsPage();

  // 1. RoleGuard wraps the page with ROLE_ADMIN
  assert.equal(vdom.type, "role-guard");
  assert.equal(vdom.props.allowedRoles.length, 1);
  assert.equal(vdom.props.allowedRoles[0], "ROLE_ADMIN");
  const fallbackText = findNodes(vdom.props.fallback, (c) => typeof c === "string").join("");
  assert.ok(fallbackText.includes("Không có quyền truy cập"), "RoleGuard fallback must deny non-admin access");

  // 2. Rendering authorized children mounts ScheduleGrid with all 6 pagination/search props wired
  const managementNode = vdom.props.children;
  // Trigger children evaluation
  findNodes(managementNode, (n) => n.type === "schedule-grid");

  assert.ok(capturedScheduleGridProps, "ScheduleGrid must be rendered inside ShiftsPage");
  assert.equal(capturedScheduleGridProps.scheduleKeyword, "NV005", "scheduleKeyword must be forwarded from useShifts");
  assert.equal(capturedScheduleGridProps.schedulePage, 2, "schedulePage must be forwarded from useShifts");
  assert.equal(capturedScheduleGridProps.scheduleTotalPages, 4, "scheduleTotalPages must be forwarded from useShifts");
  assert.equal(capturedScheduleGridProps.scheduleTotalElements, 75, "scheduleTotalElements must be forwarded from useShifts");

  // 3. Handlers forwarded from model
  capturedScheduleGridProps.handleScheduleKeywordChange("NV999");
  assert.equal(keywordChangedTo, "NV999", "Invoking handleScheduleKeywordChange from ScheduleGrid calls useShifts handler");

  capturedScheduleGridProps.setSchedulePage(3);
  assert.equal(pageChangedTo, 3, "Invoking setSchedulePage from ScheduleGrid calls useShifts handler");
});




