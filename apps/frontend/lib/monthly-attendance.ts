import type { AttendanceHistory } from "@/types/attendance.types";
import type { EmployeeShiftResponse } from "@/types/shift.types";

export function monthBounds(month: string) {
  const [year, number] = month.split("-").map(Number);
  if (!/^\d{4}-\d{2}$/.test(month) || year < 1900 || year > 9999 || number < 1 || number > 12) {
    throw new Error("Tháng không hợp lệ");
  }
  return { start: `${month}-01`, end: `${month}-${new Date(year, number, 0).getDate()}` };
}

export function formatMinutes(value: number) {
  const minutes = Math.floor(Math.max(0, value));
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

export function monthlyAttendance(
  month: string, schedule: EmployeeShiftResponse[], attendance: AttendanceHistory[],
) {
  const shifts = schedule.filter((shift) => shift.assignedDate.startsWith(`${month}-`));
  const unique = new Map(attendance.map((record) => [record.id, record]));
  const completed = new Set<string>();
  const attended = new Set<string>();
  const intervals: [number, number][] = [];
  const rows = [...unique.values()].filter((record) =>
    (record.workDate ?? record.checkInTime?.slice(0, 10) ?? "").startsWith(`${month}-`) &&
    record.checkInTime !== null && record.status !== "NO_DATA",
  ).map((record) => {
    const date = record.workDate ?? record.checkInTime!.slice(0, 10);
    const shift = shifts.find((item) => item.assignedDate === date && item.shiftId === record.shiftId);
    const checkIn = new Date(record.checkInTime!).getTime();
    const checkOut = record.checkOutTime ? new Date(record.checkOutTime).getTime() : NaN;
    const valid = Number.isFinite(checkIn) && Number.isFinite(checkOut) && checkOut > checkIn;
    const key = `${date}/${record.shiftId ?? "unassigned"}`;
    if (Number.isFinite(checkIn)) attended.add(key);
    if (valid) {
      completed.add(key);
      intervals.push([checkIn, checkOut]);
    }
    const start = shift ? new Date(`${date}T${shift.startTime}`).getTime() : NaN;
    const endDate = new Date(`${date}T${shift?.endTime ?? "00:00:00"}`);
    if (shift && shift.endTime < shift.startTime) endDate.setDate(endDate.getDate() + 1);
    // Official lateness comes from attendance status; grace has already been applied by the server.
    const late = record.status === "LATE";
    const lateMinutes = late && Number.isFinite(start) ? Math.max(0, (checkIn - start) / 60000) : null;
    const earlyLeave = record.status === "EARLY_LEAVE" ||
      (valid && !!shift && checkOut < endDate.getTime());
    return { record, date, shift, valid, minutes: valid ? (checkOut - checkIn) / 60000 : 0,
      late, lateMinutes, earlyLeave,
      missingCheckout: !record.checkOutTime,
      invalidTime: !!record.checkOutTime && !valid };
  }).sort((a, b) => b.date.localeCompare(a.date) || b.record.id - a.record.id);

  // Merge overlapping sessions so duplicate/overlapping records cannot inflate total hours.
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  const plannedMinutes = shifts.reduce((sum, shift) => {
    const start = new Date(`${shift.assignedDate}T${shift.startTime}`);
    const end = new Date(`${shift.assignedDate}T${shift.endTime}`);
    if (end < start) end.setDate(end.getDate() + 1);
    return sum + Math.max(0, (end.getTime() - start.getTime()) / 60000);
  }, 0);
  return {
    rows, planned: shifts.length, plannedMinutes, attended: attended.size, completed: completed.size,
    workedMinutes: merged.reduce((sum, [start, end]) => sum + (end - start) / 60000, 0),
    late: rows.filter((row) => row.late).length,
    earlyLeave: rows.filter((row) => row.earlyLeave).length,
    missingCheckout: rows.filter((row) => row.missingCheckout).length,
    invalidTime: rows.filter((row) => row.invalidTime).length,
    unmatched: rows.filter((row) => !row.shift).length,
  };
}
