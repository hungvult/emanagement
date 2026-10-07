"use client";
import { BankingEkycModal } from "@/components/ekyc/banking-ekyc-modal";
import type { useEmployees } from "@/hooks/employees/use-employees";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  "isEkycOpen" | "setIsEkycOpen" | "ekycEmployee" | "handleEnrollComplete"
>;

export function EmployeeEnrollment({
  isEkycOpen,
  setIsEkycOpen,
  ekycEmployee,
  handleEnrollComplete,
}: Props) {
  return (
    <>
      <BankingEkycModal
        isOpen={isEkycOpen}
        onClose={() => setIsEkycOpen(false)}
        employeeName={ekycEmployee?.fullName || ""}
        employeeCode={ekycEmployee?.employeeCode || ""}
        onCompleteAll={handleEnrollComplete}
      />
    </>
  );
}
