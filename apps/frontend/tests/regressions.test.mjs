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
