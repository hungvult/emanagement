import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/notification-utils.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { notificationLink, notificationDate } = exports;

test("notifications link to the related record and reject external destinations", () => {
  assert.equal(notificationLink({ type: "LEAVE_APPROVED", targetUrl: "/leave-requests?requestId=12" }), "/leave-requests?requestId=12");
  assert.equal(notificationLink({ type: "SHIFT_REMOVED" }), "/my-schedule");
  for (const targetUrl of ["https://evil.test", "//evil.test", "javascript:alert(1)", "/employees-malicious"]) {
    assert.equal(notificationLink({ type: "IMPORT_FAILED", targetUrl }), "/notifications");
  }
});

test("notification timestamps use Vietnam time when the server does not supply an offset", () => {
  assert.equal(notificationDate("2026-10-29T08:00:00").toISOString(), "2026-10-29T01:00:00.000Z");
  assert.equal(notificationDate("2026-10-29T08:00:00+07:00").toISOString(), "2026-10-29T01:00:00.000Z");
  assert.equal(notificationDate([2026, 10, 29, 8, 0]).toISOString(), "2026-10-29T01:00:00.000Z");
});
