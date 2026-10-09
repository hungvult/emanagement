import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";

// Exercise the real handler bodies with isolated APIs and state setters.
function callback(path, name, globals) {
  const source = ts.createSourceFile(
    path,
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name)
      return node;
    return ts.forEachChild(node, find);
  }
  const decl = find(source);
  const body = ts.isCallExpression(decl.initializer)
    ? decl.initializer.arguments[0]
    : decl.initializer;
  const compiled = ts.transpileModule(
    `exports.handler = ${body.getText(source)};`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    console: { error() {} },
    ...globals,
  });
  return exports.handler;
}
const noop = () => {};

for (const dryRun of [true, false]) {
  test(`bulk assignment ${dryRun ? "preview" : "commit"} keeps its save behavior after extraction`, async () => {
    let reloads = 0;
    let closes = 0;
    let payload;
    const run = callback("hooks/shifts/use-bulk-assignment.ts", "executeBulkAssign", {
      bulkForm: { shiftId: "7", startDate: "2026-10-05", endDate: "2026-10-09", daysOfWeek: ["MONDAY"], targetMode: "CUSTOM", selectedUserIds: [42], overwrite: false },
      setIsBulkPreviewing: noop, setIsBulkSubmitting: noop, setBulkResult: noop,
      setIsBulkOpen: () => { closes++; }, fetchSchedule: () => { reloads++; },
      error: message => { throw new Error(message); }, success: noop,
      shiftService: { bulkAssign: async request => { payload = request; return { status: "SUCCESS", data: { created: 1, updated: 0 } }; } },
    });
    await run(dryRun);
    assert.equal(payload.dryRun, dryRun);
    assert.equal(payload.shiftId, 7);
    assert.equal(payload.userIds[0], 42);
    assert.equal(reloads, dryRun ? 0 : 1);
    assert.equal(closes, dryRun ? 0 : 1);
  });
}

test("bulk assignment rejects reversed dates before calling the API", async () => {
  let requests = 0;
  let errors = 0;
  const run = callback("hooks/shifts/use-bulk-assignment.ts", "executeBulkAssign", {
    bulkForm: { shiftId: "7", startDate: "2026-10-09", endDate: "2026-10-05" },
    error: () => { errors++; }, shiftService: { bulkAssign: async () => { requests++; } },
  });
  await run(false);
  assert.equal(errors, 1);
  assert.equal(requests, 0);
});

test("copy-week preview never closes the dialog or reloads the saved schedule", async () => {
  let reloads = 0;
  let closes = 0;
  let payload;
  const run = callback("hooks/shifts/use-copy-week.ts", "executeCopyWeek", {
    copyWeekForm: { sourceWeekStart: "2026-10-05", targetWeekStart: "2026-10-12", targetMode: "ALL", selectedUserIds: [], overwrite: false },
    setIsCopyPreviewing: noop, setIsCopySubmitting: noop, setCopyResult: noop,
    setIsCopyWeekOpen: () => { closes++; }, fetchSchedule: () => { reloads++; },
    error: message => { throw new Error(message); }, success: noop,
    shiftService: { copyWeek: async request => { payload = request; return { status: "SUCCESS", data: { created: 1, updated: 0 } }; } },
  });
  await run(true);
  assert.equal(payload.dryRun, true);
  assert.equal(payload.userIds, undefined);
  assert.equal(reloads, 0);
  assert.equal(closes, 0);
});
const modal = "hooks/use-ekyc-flow.ts";
function stepHarness(fetch, step = 0) {
  let images = Array(step).fill("frame");
  let saves = 0;
  const scheduled = [];
  const run = callback(modal, "handleStepSuccess", {
    cvService: {
      validateFrame: async () => {
        const response = await fetch();
        const data = await response.json();
        if (!response.ok) throw new Error("HTTP failure");
        return data;
      },
    },
    currentStepIdx: step,
    capturedImages: images,
    EKYC_STEPS: Array(5).fill({}),
    sessionRef: {
      current: {
        current: 0,
        isCurrent: () => true,
        schedule: (fn, delay) => scheduled.push({ fn, delay }),
      },
    },
    isTransitioningRef: { current: false },
    captureCurrentFrame: () => "frame",
    setPromptMessage: noop,
    handleRestart: noop,
    setIsFlashing: noop,
    ekycAudio: {
      speak: noop,
      playShutterSound: noop,
      playSuccessChime: noop,
      playCompleteFanfare: noop,
    },
    setCapturedImages: (value) => {
      images = value;
    },
    lastLandmarksRef: { current: null },
    onCaptureFrame: undefined,
    setIsDoneAll: noop,
    setStepProgress: noop,
    onCompleteAll: async () => {
      saves++;
    },
  });
  return { run, scheduled, images: () => images, saves: () => saves };
}

test("failed re-enrollment preserves existing face data", async () => {
  let deleted = false;
  const run = callback(
    "hooks/employees/use-employees.ts",
    "handleEnrollComplete",
    {
      ekycEmployee: { id: 42 },
      employeeService: {
        deleteFaceData: async () => {
          deleted = true;
        },
      },
      localStorage: { getItem: () => "test-token" },
      cvService: {
        enroll: async () => {
          throw new Error("mock failure");
        },
      },
    },
  );
  await assert.rejects(run(Array(5).fill("frame")), /mock failure/);
  assert.equal(deleted, false);
});

for (const [name, fetch] of [
  [
    "network failure",
    async () => {
      throw new Error("offline");
    },
  ],
  [
    "HTTP 503 without status",
    async () => ({ ok: false, json: async () => ({ detail: "unavailable" }) }),
  ],
  [
    "HTTP 503 with VALID status",
    async () => ({ ok: false, json: async () => ({ status: "VALID" }) }),
  ],
  [
    "HTTP 200 without status",
    async () => ({ ok: true, json: async () => ({}) }),
  ],
  [
    "invalid JSON",
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    }),
  ],
]) {
  test(`frame validation stops on ${name}`, async () => {
    const harness = stepHarness(fetch);
    await harness.run();
    assert.equal(harness.images().length, 0);
    assert.ok(!harness.scheduled.some((x) => x.delay === 900));
    assert.ok(harness.scheduled.some((x) => x.delay === 2500));
  });
}

test("the fifth valid frame submits once automatically", async () => {
  const harness = stepHarness(
    async () => ({ ok: true, json: async () => ({ status: "VALID" }) }),
    4,
  );
  await harness.run();
  assert.equal(harness.images().length, 5);
  const saves = harness.scheduled.filter((x) => x.delay === 700);
  assert.equal(saves.length, 1);
  await saves[0].fn();
  assert.equal(harness.saves(), 1);
});

test("repeated notification clicks decrement unread count once", async () => {
  let notifications = [
    { id: 1, read: false },
    { id: 2, read: false },
  ];
  let unread = 2;
  let requests = 0;
  const run = callback(
    "components/layout/notification-bell.tsx",
    "handleMarkAsRead",
    {
      notifications,
      mutationPendingRef: { current: false },
      requestVersionRef: { current: 0 },
      setIsUpdating: noop,
      fetchNotifications: noop,
      notificationService: {
        markAsRead: async () => {
          requests++;
        },
      },
      setNotifications: (fn) => {
        notifications = fn(notifications);
      },
      setUnreadCount: (fn) => {
        unread = fn(unread);
      },
    },
  );
  await Promise.all([run(1), run(1)]);
  assert.equal(requests, 1);
  assert.equal(unread, 1);
  assert.equal(notifications.filter((n) => !n.read).length, 1);
});
