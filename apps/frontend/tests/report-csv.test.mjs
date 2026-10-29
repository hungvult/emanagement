import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/report-csv.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { monthlyReportCsv } = exports;

function parse(csv) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if (c === "\r" && csv[i + 1] === "\n" && !quoted) {
      row.push(field); rows.push(row); row = []; field = ""; i++;
    } else field += c;
  }
  return rows;
}

const employee = { userId: 1, employeeCode: "EMP260001", fullName: 'Nguyễn Văn "A", phòng\nKế toán',
  assignedMinutes: 480, actualMinutes: 305, earlyCount: 1, lateCount: 2, missingCheckoutCount: 0 };
const report = { year: 2026, month: 10, generatedAt: "2026-10-29T14:00:00", employees: [employee] };

test("report CSV preserves Vietnamese, quoted names and exact work durations", () => {
  const csv = monthlyReportCsv(report, report.employees);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const rows = parse(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].length, rows[0].length);
  assert.deepEqual(rows[1], ["2026-10", "EMP260001", employee.fullName, "8 giờ 0 phút", "5 giờ 5 phút",
    "480", "305", "1", "2", "0", "2026-10-29 14:00:00"]);
});

test("full CSV includes employees beyond the displayed page and filtered CSV exports only the selected rows", () => {
  const employees = Array.from({ length: 45 }, (_, i) => ({ ...employee, userId: i, employeeCode: `EMP${i}` }));
  const full = { ...report, employees };
  assert.equal(parse(monthlyReportCsv(full, employees)).length, 46);
  const filtered = parse(monthlyReportCsv(full, [employees[30]]));
  assert.equal(filtered.length, 2);
  assert.equal(filtered[1][1], "EMP30");
});

test("employee fields cannot become spreadsheet formulas", () => {
  for (const name of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1", "\t=1"]) {
    const rows = parse(monthlyReportCsv(report, [{ ...employee, fullName: name }]));
    assert.equal(rows[1][2], `'${name}`);
  }
});
