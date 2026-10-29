import type { MonthlyReport, MonthlyReportRow } from "@/services/report.service";

function csvCell(value: string | number) {
  let text = String(value);
  // Keep spreadsheet applications from evaluating employee-provided text as formulas.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function duration(minutes: number) {
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

export function monthlyReportCsv(report: MonthlyReport, employees: MonthlyReportRow[]) {
  const month = `${report.year}-${String(report.month).padStart(2, "0")}`;
  const header = ["Tháng", "Mã nhân viên", "Họ và tên", "Giờ được phân", "Giờ làm thực tế",
    "Phút được phân", "Phút làm thực tế", "Về sớm (lần)", "Đi muộn (lần)",
    "Ngày thiếu giờ ra", "Cập nhật lúc (UTC+07:00)"];
  const rows = employees.map(row => [month, row.employeeCode, row.fullName,
    duration(row.assignedMinutes), duration(row.actualMinutes), row.assignedMinutes,
    row.actualMinutes, row.earlyCount, row.lateCount, row.missingCheckoutCount,
    report.generatedAt.replace("T", " ")]);
  // UTF-8 BOM preserves Vietnamese text when the CSV is opened in Excel.
  return "\uFEFF" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadMonthlyReport(report: MonthlyReport, employees: MonthlyReportRow[], filtered: boolean) {
  const blob = new Blob([monthlyReportCsv(report, employees)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bao_cao_thang_${report.year}-${String(report.month).padStart(2, "0")}_${filtered ? "da_loc" : "toan_bo"}.csv`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
