import {
  DEFAULT_COLUMN_VISIBILITY,
  EmployeeColumnVisibility,
} from "@/types/employee.types";

export const COLUMN_STORAGE_KEY = "emanagement_employee_columns";

export function loadColumnVisibility(): EmployeeColumnVisibility {
  if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (raw) return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COLUMN_VISIBILITY;
}

export function saveColumnVisibility(vis: EmployeeColumnVisibility) {
  if (typeof window !== "undefined") {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(vis));
  }
}

export const COLUMN_LABELS: Record<keyof EmployeeColumnVisibility, string> = {
  employeeCode: "Mã NV",
  fullName: "Họ Tên",
  emailPhone: "Email / SĐT",
  status: "Trạng thái",
  ekycFaceId: "eKYC Face ID",
  createdAt: "Ngày tạo",
  actions: "Hành động",
};
