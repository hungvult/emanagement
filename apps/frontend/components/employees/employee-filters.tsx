"use client";
import { Button } from "@/components/ui/button";
import type { useEmployees } from "@/hooks/employees/use-employees";
import { COLUMN_LABELS } from "@/lib/employees-helpers";
import { EmployeeColumnVisibility } from "@/types/employee.types";
import { Check, Columns3, Filter, Plus, Search, UploadCloud, X } from "lucide-react";

type Props = Pick<
  ReturnType<typeof useEmployees>,
  | "searchTerm"
  | "setSearchTerm"
  | "showFilters"
  | "setShowFilters"
  | "activeFilterCount"
  | "showColumnPicker"
  | "setShowColumnPicker"
  | "setIsCreateOpen"
  | "setIsBulkImportOpen"
  | "filterStatus"
  | "setFilterStatus"
  | "setPage"
  | "filterFace"
  | "setFilterFace"
  | "toggleColumn"
  | "columnVis"
>;

export function EmployeeFilters({
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  activeFilterCount,
  showColumnPicker,
  setShowColumnPicker,
  setIsCreateOpen,
  setIsBulkImportOpen,
  filterStatus,
  setFilterStatus,
  setPage,
  filterFace,
  setFilterFace,
  toggleColumn,
  columnVis,
}: Props) {
  return (
    <>
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 md:p-8 rounded-[24px] border border-slate-100 shadow-sm animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Quản lý nhân viên
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-lg">
            Quản lý danh sách nhân sự, phân quyền và dữ liệu nhận diện khuôn mặt
            (eKYC).
          </p>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto mt-4 lg:mt-0">
          {/* Search */}
          <div className="relative w-full lg:w-64 group shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              placeholder="Tìm tên, mã, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-transparent rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar shrink-0 w-full lg:w-auto">
            {/* Filter toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-4 font-semibold transition-all ${
                showFilters
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full h-5 w-5 flex items-center justify-center shadow-sm border-2 border-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Column picker toggle */}
            <Button
              variant={showColumnPicker ? "default" : "outline"}
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className={`flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-4 font-semibold transition-all ${
                showColumnPicker
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Columns3 className="h-4 w-4" />
              <span>Cột hiển thị</span>
            </Button>

            <Button
              onClick={() => setIsBulkImportOpen(true)}
              variant="outline"
              className="flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-4 font-bold border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-900 transition-all shadow-xs"
            >
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              <span>Nhập hàng loạt</span>
            </Button>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl h-[42px] px-5 font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4" /> Thêm mới
            </Button>
          </div>
        </div>
      </div>
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <Filter className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-sm font-bold text-slate-800">Bộ lọc:</span>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <label className="text-sm font-semibold text-slate-500">
                Trạng thái
              </label>
              <select
                className="rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white hover:bg-white transition-all shadow-sm"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">🟢 Đang hoạt động (ACTIVE)</option>
                <option value="INACTIVE">🔴 Vô hiệu hóa (INACTIVE)</option>
              </select>
            </div>
            <div className="flex items-center gap-2.5">
              <label className="text-sm font-semibold text-slate-500">
                Face ID
              </label>
              <select
                className="rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white hover:bg-white transition-all shadow-sm"
                value={filterFace}
                onChange={(e) => {
                  setFilterFace(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả</option>
                <option value="true">✅ Đã đăng ký</option>
                <option value="false">❌ Chưa đăng ký</option>
              </select>
            </div>
          </div>
          {(filterStatus || filterFace) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilterStatus("");
                setFilterFace("");
              }}
              className="ml-auto text-sm font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl px-4"
            >
              <X className="h-4 w-4 mr-1.5" /> Xóa bộ lọc
            </Button>
          )}
        </div>
      )}
      {showColumnPicker && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mr-2">
            <div className="h-8 w-8 rounded-full bg-violet-50 flex items-center justify-center">
              <Columns3 className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-sm font-bold text-slate-800">
              Hiển thị cột:
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(
              Object.keys(COLUMN_LABELS) as Array<
                keyof EmployeeColumnVisibility
              >
            ).map((col) => (
              <button
                key={col}
                onClick={() => toggleColumn(col)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                  columnVis[col]
                    ? "bg-indigo-50/50 text-indigo-700 border-indigo-500/20 hover:border-indigo-500/40"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${columnVis[col] ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`}
                >
                  {columnVis[col] && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                {COLUMN_LABELS[col]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
