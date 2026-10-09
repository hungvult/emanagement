"use client";
import { Button } from "@/components/ui/button";
import { Calendar, Copy, Layers, Plus, UserCheck } from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "handleOpenCopyWeek"
  | "handleOpenBulk"
  | "setIsAssignOpen"
  | "setIsCreateOpen"
>;

export function ShiftToolbar({
  handleOpenCopyWeek,
  handleOpenBulk,
  setIsAssignOpen,
  setIsCreateOpen,
}: Props) {
  return (
    <>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-indigo-600" />
            Quản lý Ca làm việc & Phân ca
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
            Thiết lập danh mục ca, phân ca theo ngày, phân ca hàng loạt và sao
            chép lịch tuần tự động.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleOpenCopyWeek}
            className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
          >
            <Copy className="h-4 w-4" /> Sao chép tuần
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenBulk}
            className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
          >
            <Layers className="h-4 w-4" /> Phân ca hàng loạt
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsAssignOpen(true)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border-slate-200"
          >
            <UserCheck className="h-4 w-4" /> Phân ca đơn
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" /> Tạo ca mới
          </Button>
        </div>
      </div>
    </>
  );
}
