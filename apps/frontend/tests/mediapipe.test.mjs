import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function engine(FaceMesh, clock = { now: () => Date.now() }) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../lib/ekyc-mediapipe.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, window: { FaceMesh }, Date: clock, console: { error() {}, warn() {} } });
  return new exports.EkycMediaPipeEngine();
}

test('inference waits for model initialization and serializes slow frames', async () => {
  let initialize;
  let finish;
  let sends = 0;
  let resultCallback;
  const instance = engine(class {
    setOptions() {}
    initialize() { return new Promise(resolve => { initialize = resolve; }); }
    onResults(fn) { resultCallback = fn; }
    send() { sends++; return new Promise(resolve => { finish = () => { resultCallback({ multiFaceLandmarks: [] }); resolve(); }; }); }
    async close() {}
  });
  const loading = instance.loadModel();
  assert.equal(sends, 0);
  initialize();
  await loading;
  const first = instance.processFrame({}, 'blink');
  const concurrent = await instance.processFrame({}, 'blink');
  assert.equal(concurrent.status, 'INITIALIZING');
  assert.equal(concurrent.isMatched, false);
  assert.equal(sends, 1);
  finish();
  assert.equal((await first).status, 'NO_FACE');
});

test('a missing model never accepts a pose and failed initialization can recover', async () => {
  let now = 10000;
  let attempts = 0;
  const instance = engine(class {
    setOptions() {}
    async initialize() { if (++attempts === 1) throw new Error('missing model'); }
    async close() {}
    onResults(fn) { this.listener = fn; }
    async send() { this.listener({ multiFaceLandmarks: [] }); }
  }, { now: () => now });
  for (const pose of ['front', 'blink']) {
    const result = await instance.processFrame({}, pose);
    assert.equal(result.status, 'MODEL_ERROR');
    assert.equal(result.isMatched, false);
  }
  assert.equal(attempts, 1);
  now += 5001;
  assert.equal((await instance.processFrame({}, 'blink')).status, 'NO_FACE');
  assert.equal(attempts, 2);
});

test('inference failure stops retries until backoff and does not use heuristic poses', async () => {
  let sends = 0;
  let closed = 0;
  const instance = engine(class {
    setOptions() {}
    async initialize() {}
    onResults() {}
    async send() { sends++; throw new Error('graph failure'); }
    async close() { closed++; }
  });
  const failed = await instance.processFrame({}, 'blink');
  assert.equal(failed.status, 'MODEL_ERROR');
  assert.equal(failed.isMatched, false);
  await instance.processFrame({}, 'front');
  assert.equal(sends, 1);
  assert.equal(closed, 1);
});

test('blink requires an open, closed, reopened sequence from landmarks', () => {
  let now = 10000;
  const instance = engine(class {}, { now: () => now });
  instance.resetBlink();
  now += 601;
  function analyze(ear) {
    const lm = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[234].x = 0.25; lm[454].x = 0.75;
    lm[10].y = 0.25; lm[152].y = 0.75;
    lm[33].x = 0.35; lm[133].x = 0.45;
    lm[362].x = 0.55; lm[263].x = 0.65;
    for (const [upper, lower] of [[160,144],[158,153],[159,145],[385,380],[387,373],[386,374]]) {
      lm[upper].y = 0.4 - ear * 0.05;
      lm[lower].y = 0.4 + ear * 0.05;
    }
    now += 100;
    return instance.analyzeLandmarks({ multiFaceLandmarks: [lm] }, 'blink', {});
  }
  for (let i = 0; i < 12; i++) assert.equal(analyze(0.25).isMatched, false);
  assert.equal(analyze(0.08).isMatched, false);
  analyze(0.25);
  analyze(0.25);
  assert.equal(analyze(0.25).isMatched, true);
});
