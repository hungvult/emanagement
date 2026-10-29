import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import axios from "axios";

const require = createRequire(import.meta.url);

test("monthly attendance counts completed shifts separately from open sessions and scheduled hours", () => {
  const { monthlyAttendance, formatMinutes, monthBounds } = loadTs("lib/monthly-attendance.ts");
  assert.equal(monthBounds("2024-02").end, "2024-02-29");
  assert.equal(monthBounds("2026-02").end, "2026-02-28");
  assert.throws(() => monthBounds("2026-13"));
  assert.throws(() => monthBounds("bad"));
  const schedule = [29, 30, 31].map((day) => ({
    id: day, shiftId: 1, assignedDate: `2026-10-${day}`, startTime: "08:00:00", endTime: "17:00:00",
  }));
  schedule.push({ ...schedule[0], assignedDate: "2026-11-01" });
  const record = (id, day, checkIn, checkOut, status) => ({
    id, shiftId: 1, workDate: `2026-10-${day}`, checkInTime: checkIn ? `2026-10-${day}T${checkIn}:00` : null,
    checkOutTime: checkOut ? `2026-10-${day}T${checkOut}:00` : null, status,
  });
  const records = [
    record(1, 29, "07:45", "17:00", "ON_TIME"),
    record(2, 30, "08:10", "16:00", "ON_TIME"), // grace: not officially late
    record(3, 31, "08:20", null, "LATE"),
    record(-1, 28, null, null, "NO_DATA"),
    record(4, 31, "10:00", "09:00", "LATE"), // invalid, never negative hours
  ];
  const result = monthlyAttendance("2026-10", schedule, records);
  assert.equal(result.planned, 3);
  assert.equal(result.plannedMinutes, 27 * 60);
  assert.equal(result.attended, 3);
  assert.equal(result.completed, 2);
  assert.equal(result.workedMinutes, 555 + 470);
  assert.equal(result.early, 1);
  assert.equal(result.earlyLeave, 1);
  assert.equal(result.late, 2);
  assert.equal(result.missingCheckout, 1);
  assert.equal(result.invalidTime, 1);
  assert.equal(result.rows.find((row) => row.record.id === 3).lateMinutes, 20);
  assert.equal(formatMinutes(125.9), "2 giờ 5 phút");
});

test("monthly attendance merges overlaps, deduplicates IDs, and handles overnight and unmatched shifts", () => {
  const { monthlyAttendance } = loadTs("lib/monthly-attendance.ts");
  const schedule = [{ shiftId: 1, assignedDate: "2026-10-31", startTime: "22:00:00", endTime: "06:00:00" }];
  const overnight = { id: 1, shiftId: 1, workDate: "2026-10-31", checkInTime: "2026-10-31T22:00:00", checkOutTime: "2026-11-01T06:00:00", status: "ON_TIME" };
  const overlap = { ...overnight, id: 2, checkInTime: "2026-10-31T23:00:00", status: "LATE" };
  const unmatched = { ...overnight, id: 3, shiftId: 2, workDate: "2026-10-30", checkInTime: "2026-10-30T08:00:00", checkOutTime: "2026-10-30T10:00:00", status: "EARLY_LEAVE" };
  const outside = { ...overnight, id: 4, workDate: "2026-11-01" };
  const result = monthlyAttendance("2026-10", schedule, [overnight, overnight, overlap, unmatched, outside]);
  assert.equal(result.rows.length, 3);
  assert.equal(result.workedMinutes, 10 * 60);
  assert.equal(result.plannedMinutes, 8 * 60);
  assert.equal(result.completed, 2);
  assert.equal(result.unmatched, 1);
  assert.equal(result.earlyLeave, 1);
  assert.equal(monthlyAttendance("2026-12", [], []).workedMinutes, 0);
});

test("monthly attendance loads every page and retains previous data on partial failure", async () => {
  const state = [];
  let version = 0;
  let fail = false;
  const pages = [];
  const react = {
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useState: (value) => {
      const index = state.length;
      state.push(value);
      return [value, (next) => { state[index] = next; }];
    },
  };
  const { useMonthlyAttendance } = loadTs("hooks/shifts/use-monthly-attendance.ts", {}, {
    react,
    "@/hooks/use-latest-request": { useLatestRequest: () => () => {
      const current = ++version;
      return () => current === version;
    } },
    "@/lib/monthly-attendance": loadTs("lib/monthly-attendance.ts"),
    "@/services/shift.service": { shiftService: { getMySchedule: async () => ({ status: "SUCCESS", data: [] }) } },
    "@/services/attendance.service": { attendanceService: { getMyHistory: async (userId, page, size, filters) => {
      assert.equal(userId, undefined);
      assert.equal(filters.startDate, "2026-10-01");
      assert.equal(filters.endDate, "2026-10-31");
      assert.equal(filters.recordedOnly, true);
      pages.push(page);
      if (fail && page === 1) throw new Error("network");
      return { status: "SUCCESS", data: { totalPages: 2, content: [
        { id: page, shiftId: 1, workDate: `2026-10-0${page + 1}`, checkInTime: `2026-10-0${page + 1}T08:00:00`, checkOutTime: `2026-10-0${page + 1}T17:00:00`, status: "ON_TIME" },
      ] } };
    } } },
  });
  const { refresh } = useMonthlyAttendance("2026-10");
  await refresh();
  assert.deepEqual(pages, [0, 1]);
  assert.equal(state[0].summary.completed, 2);
  assert.equal(state[0].summary.workedMinutes, 18 * 60);
  const previous = state[0];
  fail = true;
  await refresh();
  assert.match(state[2], /Không tải được/);
  assert.equal(state[0], previous);
  assert.equal(state[1], false);
});

test("monthly attendance request uses authenticated identity and recorded-only filtering", async () => {
  const urls = [];
  const { attendanceService } = loadTs("services/attendance.service.ts", { URLSearchParams }, {
    "@/lib/api-client": { apiClient: { get: async (url) => { urls.push(url); return {}; } } },
  });
  await attendanceService.getMyHistory(undefined, 0, 100,
    { startDate: "2026-10-01", endDate: "2026-10-31", recordedOnly: true });
  const params = new URL(urls[0], "http://localhost").searchParams;
  assert.equal(params.has("userId"), false);
  assert.equal(params.get("recordedOnly"), "true");
  assert.equal(params.get("startDate"), "2026-10-01");
  await attendanceService.getMyHistory(42);
  assert.equal(new URL(urls[1], "http://localhost").searchParams.get("userId"), "42");
});

test("personal schedule distinguishes approved leave with inclusive dates", () => {
  const { hasApprovedLeave } = loadTs("lib/my-schedule.ts");
  const leaves = [
    { status: "APPROVED", startDate: "2026-10-29", endDate: "2026-10-31" },
    { status: "PENDING", startDate: "2026-11-01", endDate: "2026-11-01" },
    { status: "REJECTED", startDate: "2026-11-02", endDate: "2026-11-02" },
  ];
  for (const day of ["2026-10-29", "2026-10-30", "2026-10-31"]) {
    assert.equal(hasApprovedLeave(leaves, day), true);
  }
  for (const day of ["2026-10-28", "2026-11-01", "2026-11-02"]) {
    assert.equal(hasApprovedLeave(leaves, day), false);
  }
});

test("upcoming shift excludes started shifts and approved leave and sorts by start", () => {
  const { getUpcomingShift } = loadTs("lib/my-schedule.ts");
  const shifts = [
    { id: 4, assignedDate: "2026-11-01", startTime: "08:00:00" },
    { id: 3, assignedDate: "2026-10-31", startTime: "08:00:00" },
    { id: 1, assignedDate: "2026-10-29", startTime: "08:00:00" },
    { id: 2, assignedDate: "2026-10-30", startTime: "08:00:00" },
  ];
  const leaves = [{ status: "APPROVED", startDate: "2026-10-30", endDate: "2026-10-30" }];
  assert.equal(getUpcomingShift(shifts, leaves, new Date("2026-10-29T08:00:00")).id, 3);
  assert.equal(getUpcomingShift(shifts, leaves, new Date("2026-10-29T07:00:00")).id, 1);
  assert.equal(getUpcomingShift(shifts, leaves, new Date("2026-11-02T08:00:00")), undefined);
  assert.equal(getUpcomingShift([], [], new Date()), undefined);
  assert.equal(shifts[0].id, 4);
});

test("personal leave fetch uses the authenticated employee when no ID is supplied", async () => {
  const urls = [];
  const { leaveService } = loadTs("services/leave.service.ts", {}, {
    "@/lib/api-client": { apiClient: { get: async (url) => { urls.push(url); return {}; } } },
  });
  await leaveService.getMyRequests();
  await leaveService.getMyRequests(42);
  assert.deepEqual(urls, ["/leave-requests/my-requests", "/leave-requests/my-requests?userId=42"]);
});

test("personal schedule refresh reports failures, retries, and discards stale responses", async () => {
  const state = [];
  let version = 0;
  let fail = false;
  let pause;
  const react = {
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useState: (value) => {
      const index = state.length;
      state.push(value);
      return [value, (next) => { state[index] = next; }];
    },
  };
  const { useMySchedule } = loadTs("hooks/shifts/use-my-schedule.ts", {}, {
    react,
    "@/hooks/use-latest-request": { useLatestRequest: () => () => {
      const current = ++version;
      return () => current === version;
    } },
    "@/lib/shifts-helpers": loadTs("lib/shifts-helpers.ts"),
    "@/services/shift.service": { shiftService: { getMySchedule: async () => {
      const pending = pause;
      if (pending) await pending;
      if (fail) throw new Error("network");
      return { status: "SUCCESS", data: [] };
    } } },
    "@/services/leave.service": { leaveService: { getMyRequests: async () => ({ status: "SUCCESS", data: [] }) } },
  });
  const { refresh } = useMySchedule("2026-10-26", "2026-11-01");
  await refresh();
  assert.equal(state[0].range, "2026-10-26/2026-11-01");
  const previousData = state[0];
  fail = true;
  await refresh();
  assert.equal(state[0], previousData);
  assert.match(state[2], /Không thể cập nhật/);
  assert.equal(state[1], false);
  fail = false;
  await refresh();
  assert.equal(state[2], null);
  let release;
  pause = new Promise((resolve) => { release = resolve; });
  const old = refresh();
  pause = undefined;
  await refresh();
  const latestData = state[0];
  release();
  await old;
  assert.equal(state[0], latestData);
});

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
