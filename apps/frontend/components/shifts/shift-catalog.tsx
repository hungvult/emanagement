"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SHIFT_COLORS } from "@/lib/shifts-helpers";
import { Clock, Edit2, Trash2 } from "lucide-react";

import type { useShifts } from "@/hooks/shifts/use-shifts";

type Props = Pick<
  ReturnType<typeof useShifts>,
  | "shifts"
  | "includeInactive"
  | "setIncludeInactive"
  | "handleOpenEdit"
  | "handleOpenDelete"
>;

export function ShiftCatalog({
  shifts,
  includeInactive,
  setIncludeInactive,
  handleOpenEdit,
  handleOpenDelete,
}: Props) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" /> Danh mục ca làm việc (
            {shifts.length})
          </h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Hiển thị ca đã ngừng sử dụng
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shifts.map((shift, i) => {
            const color = SHIFT_COLORS[i % SHIFT_COLORS.length];
            const isDefault = shift.shiftCode === "DEFAULT";
            return (
              <Card
                key={shift.id}
                className={`hover:border-indigo-200 hover:shadow-md transition-all shadow-sm bg-white border-slate-100 rounded-2xl relative group ${
                  !shift.active ? "opacity-60 bg-slate-50 border-dashed" : ""
                }`}
              >
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800 line-clamp-1">
                        {shift.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold ${color.text} ${color.border} ${color.bg}`}
                        >
                          {shift.shiftCode}
                        </Badge>
                        {!shift.active && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold bg-slate-200 text-slate-600"
                          >
                            Ngừng dùng
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Nút Sửa / Xóa */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(shift)}
                        title="Chỉnh sửa ca"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleOpenDelete(shift)}
                          title="Xóa / Ngừng sử dụng ca"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 px-5">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className={`h-4 w-4 ${color.text}`} />
                    <span className="text-sm font-bold text-slate-700">
                      {shift.startTime.slice(0, 5)} –{" "}
                      {shift.endTime.slice(0, 5)}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-500 mt-1.5 font-medium">
                    Cho phép trễ:{" "}
                    <strong className="text-slate-700">
                      {shift.gracePeriodMinutes} phút
                    </strong>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
