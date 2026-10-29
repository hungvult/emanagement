import type { LeaveRequestResponse } from "@/types/leave.types";
import type { EmployeeShiftResponse } from "@/types/shift.types";

export function hasApprovedLeave(leaves: LeaveRequestResponse[], date: string) {
  return leaves.some((leave) => leave.status === "APPROVED" &&
    leave.startDate <= date && date <= leave.endDate);
}

export function getUpcomingShift(
  shifts: EmployeeShiftResponse[], leaves: LeaveRequestResponse[], now: Date,
) {
  return shifts.filter((shift) => !hasApprovedLeave(leaves, shift.assignedDate) &&
    new Date(`${shift.assignedDate}T${shift.startTime}`).getTime() > now.getTime())
    .sort((a, b) => `${a.assignedDate}T${a.startTime}`.localeCompare(`${b.assignedDate}T${b.startTime}`))[0];
}
