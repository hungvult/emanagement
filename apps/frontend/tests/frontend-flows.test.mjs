import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

// Exercise the real handler bodies with isolated APIs and state setters.
function callback(path, name, globals) {
  const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) return node;
    return ts.forEachChild(node, find);
  }
  const decl = find(source);
  const body = ts.isCallExpression(decl.initializer) ? decl.initializer.arguments[0] : decl.initializer;
  const compiled = ts.transpileModule(`exports.handler = ${body.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console: { error() {} }, ...globals });
  return exports.handler;
}
const noop = () => {};
const modal = 'components/ekyc/banking-ekyc-modal.tsx';
function stepHarness(fetch, step = 0) {
  let images = Array(step).fill('frame');
  let saves = 0;
  const scheduled = [];
  const run = callback(modal, 'handleStepSuccess', {
    fetch, currentStepIdx: step, capturedImages: images, EKYC_STEPS: Array(5).fill({}),
    sessionRef: { current: { current: 0, isCurrent: () => true, schedule: (fn, delay) => scheduled.push({ fn, delay }) } },
    isTransitioningRef: { current: false }, captureCurrentFrame: () => 'frame',
    setPromptMessage: noop, handleRestart: noop, setIsFlashing: noop,
    ekycAudio: { speak: noop, playShutterSound: noop, playSuccessChime: noop, playCompleteFanfare: noop },
    setCapturedImages: value => { images = value; }, lastLandmarksRef: { current: null },
    onCaptureFrame: undefined, setIsDoneAll: noop, setStepProgress: noop,
    onCompleteAll: async () => { saves++; },
  });
  return { run, scheduled, images: () => images, saves: () => saves };
}

test('failed re-enrollment preserves existing face data', async () => {
  let deleted = false;
  const run = callback('app/(dashboard)/employees/page.tsx', 'handleEnrollComplete', {
    ekycEmployee: { id: 42 },
    employeeService: { deleteFaceData: async () => { deleted = true; } },
    localStorage: { getItem: () => 'test-token' },
    fetch: async () => ({ ok: false, json: async () => ({ status: 'INTERNAL_ERROR', message: 'mock failure' }) }),
  });
  await assert.rejects(run(Array(5).fill('frame')), /mock failure/);
  assert.equal(deleted, false);
});

for (const [name, fetch] of [
  ['network failure', async () => { throw new Error('offline'); }],
  ['HTTP 503 without status', async () => ({ ok: false, json: async () => ({ detail: 'unavailable' }) })],
  ['HTTP 503 with VALID status', async () => ({ ok: false, json: async () => ({ status: 'VALID' }) })],
  ['HTTP 200 without status', async () => ({ ok: true, json: async () => ({}) })],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } })],
]) {
  test(`frame validation stops on ${name}`, async () => {
    const harness = stepHarness(fetch);
    await harness.run();
    assert.equal(harness.images().length, 0);
    assert.ok(!harness.scheduled.some(x => x.delay === 900));
    assert.ok(harness.scheduled.some(x => x.delay === 2500));
  });
}

test('the fifth valid frame submits once automatically', async () => {
  const harness = stepHarness(async () => ({ ok: true, json: async () => ({ status: 'VALID' }) }), 4);
  await harness.run();
  assert.equal(harness.images().length, 5);
  const saves = harness.scheduled.filter(x => x.delay === 700);
  assert.equal(saves.length, 1);
  await saves[0].fn();
  assert.equal(harness.saves(), 1);
});

test('repeated notification clicks decrement unread count once', async () => {
  let notifications = [{ id: 1, read: false }, { id: 2, read: false }];
  let unread = 2;
  let requests = 0;
  const run = callback('components/layout/notification-bell.tsx', 'handleMarkAsRead', {
    notifications, mutationPendingRef: { current: false }, requestVersionRef: { current: 0 },
    setIsUpdating: noop, fetchNotifications: noop,
    notificationService: { markAsRead: async () => { requests++; } },
    setNotifications: fn => { notifications = fn(notifications); },
    setUnreadCount: fn => { unread = fn(unread); },
  });
  await Promise.all([run(1), run(1)]);
  assert.equal(requests, 1);
  assert.equal(unread, 1);
  assert.equal(notifications.filter(n => !n.read).length, 1);
});
