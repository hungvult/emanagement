"use client";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { useEmployees } from "@/hooks/employees/use-employees";
import { formatDateTime } from "@/lib/utils";
import {
  Camera,
  Check,
  Edit,
  Loader2,
  RefreshCw,
  ScanFace,
  Search,
  Trash2,
} from "lucide-react";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  | "isLoading"
  | "columnVis"
  | "employees"
  | "openDetailModal"
  | "openFaceModal"
  | "openEkycModal"
  | "handleDeleteFace"
  | "handleOpenEdit"
  | "handleDelete"
  | "page"
  | "totalPages"
  | "setPage"
  | "fetchEmployees"
>;

export function EmployeeTable({
  isLoading,
  columnVis,
  employees,
  openDetailModal,
  openFaceModal,
  openEkycModal,
  handleDeleteFace,
  handleOpenEdit,
  handleDelete,
  page,
  totalPages,
  setPage,
  fetchEmployees,
}: Props) {
  return (
    <>
      <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-16 px-6">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm font-semibold text-slate-500">
              Đang tải dữ liệu nhân viên...
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    {columnVis.employeeCode && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        Mã NV
                      </TableHead>
                    )}
                    {columnVis.fullName && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        Họ Tên
                      </TableHead>
                    )}
                    {columnVis.emailPhone && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        Email / SĐT
                      </TableHead>
                    )}
                    {columnVis.status && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        Trạng thái
                      </TableHead>
                    )}
                    {columnVis.ekycFaceId && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        eKYC Face ID
                      </TableHead>
                    )}
                    {columnVis.createdAt && (
                      <TableHead className="font-bold text-slate-600 h-14">
                        Ngày tạo
                      </TableHead>
                    )}
                    {columnVis.actions && (
                      <TableHead className="text-right font-bold text-slate-600 h-14 pr-6">
                        Hành động
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          Object.values(columnVis).filter(Boolean).length || 7
                        }
                        className="text-center py-16 text-slate-400 font-medium h-32"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Search className="h-6 w-6 text-slate-300" />
                          </div>
                          <p>Không tìm thấy nhân viên nào phù hợp</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className="group cursor-pointer hover:bg-slate-50/80 transition-colors border-slate-100 h-16"
                        onClick={() => openDetailModal(emp)}
                      >
                        {columnVis.employeeCode && (
                          <TableCell
                            className="font-bold text-slate-700"
                            onClick={() => openDetailModal(emp)}
                          >
                            {emp.employeeCode}
                          </TableCell>
                        )}
                        {columnVis.fullName && (
                          <TableCell onClick={() => openDetailModal(emp)}>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                                {emp.fullName?.charAt(0) || "U"}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {emp.fullName}
                                </span>
                                {emp.roles.includes("ROLE_ADMIN") && (
                                  <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-inset ring-rose-500/20 mt-0.5">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {columnVis.emailPhone && (
                          <TableCell onClick={() => openDetailModal(emp)}>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700">
                                {emp.email || "—"}
                              </span>
                              <span className="text-[13px] font-medium text-slate-400">
                                {emp.phone || "—"}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {columnVis.status && (
                          <TableCell onClick={() => openDetailModal(emp)}>
                            {emp.status === "ACTIVE" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200 shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                INACTIVE
                              </span>
                            )}
                          </TableCell>
                        )}
                        {columnVis.ekycFaceId && (
                          <TableCell onClick={() => openDetailModal(emp)}>
                            {emp.hasRegisteredFace ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 border border-emerald-100 shadow-sm">
                                  <Check className="h-3 w-3" /> Đã có Face ID
                                </span>
                                <div
                                  className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-100 rounded-lg shadow-sm overflow-hidden"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openFaceModal(emp)}
                                    title="Xem khuôn mặt"
                                    className="h-8 w-8 p-0 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 rounded-none border-r border-slate-100"
                                  >
                                    <ScanFace className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEkycModal(emp)}
                                    title="Quét lại Face ID"
                                    className="h-8 w-8 p-0 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 rounded-none border-r border-slate-100"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteFace(emp)}
                                    title="Xóa dữ liệu khuôn mặt"
                                    className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-none"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="inline-flex items-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEkycModal(emp)}
                                  className="text-xs font-bold text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shadow-sm h-7 rounded-md px-2.5 flex items-center gap-1.5"
                                >
                                  <Camera className="h-3.5 w-3.5" /> Quét khuôn
                                  mặt
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                        {columnVis.createdAt && (
                          <TableCell
                            className="text-[13px] font-medium text-slate-500"
                            onClick={() => openDetailModal(emp)}
                          >
                            {formatDateTime(emp.createdAt)}
                          </TableCell>
                        )}
                        {columnVis.actions && (
                          <TableCell
                            className="text-right pr-6"
                            onClick={() => openDetailModal(emp)}
                          >
                            <div
                              className="flex justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => handleOpenEdit(emp)}
                                title="Chỉnh sửa"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                onClick={() => handleDelete(emp.id)}
                                disabled={emp.roles.includes("ROLE_ADMIN")}
                                title="Vô hiệu hóa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="border-t border-slate-100 p-4 bg-slate-50/30">
              <Pagination
                pageNumber={page}
                totalPages={totalPages}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  void fetchEmployees(nextPage);
                }}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
