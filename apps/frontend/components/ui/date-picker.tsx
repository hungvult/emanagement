"use client";
import { parseDateInput, isDateWithinBounds } from "@/lib/date-input";

import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface DatePickerProps {
  value: string; // Định dạng chuẩn: YYYY-MM-DD (hoặc rỗng "")
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
}

const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const WEEKDAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return isoDate;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className,
  disabled = false,
  min,
  max,
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Text đang nhập thủ công nếu có
  const [inputDraft, setInputDraft] = useState<{
    value: string;
    text: string;
  } | null>(null);
  const inputText =
    inputDraft?.value === value ? inputDraft.text : toDisplay(value);
  const setInputText = (text: string) => setInputDraft({ value, text });

  // Tháng và năm đang xem trên popup lịch
  const initialViewDate = useMemo(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  }, [value]);

  const [viewDraft, setViewDraft] = useState<{
    value: string;
    date: Date;
  } | null>(null);
  const viewDate =
    viewDraft?.value === value ? viewDraft.date : initialViewDate;
  const setViewDate = (date: Date) => setViewDraft({ value, date });
  const isSelectable = (date: string) => isDateWithinBounds(date, min, max);

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const isoString = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isSelectable(isoString)) return;
    onChange(isoString);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setInputText("");
  };

  const handleQuickToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const isoString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    onChange(isoString);
    setIsOpen(false);
  };

  // Xử lý khi người dùng gõ trực tiếp dd/mm/yyyy
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    const parsed = parseDateInput(val);
    if (parsed && isSelectable(parsed)) {
      onChange(parsed);
    } else if (val.trim() === "") {
      onChange("");
    }
  };

  const handleInputBlur = () => {
    const parsed = parseDateInput(inputText);
    if (parsed) {
      onChange(parsed);
      setInputText(toDisplay(parsed));
    } else {
      setInputText(toDisplay(value));
    }
  };

  // Tính toán các ngày hiển thị trong tháng
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 0 for Mon
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === viewYear && today.getMonth() === viewMonth;
  const todayDate = today.getDate();

  const selectedParts = value ? value.split("-") : [];
  const selectedYear =
    selectedParts.length === 3 ? parseInt(selectedParts[0], 10) : -1;
  const selectedMonth =
    selectedParts.length === 3 ? parseInt(selectedParts[1], 10) - 1 : -1;
  const selectedDay =
    selectedParts.length === 3 ? parseInt(selectedParts[2], 10) : -1;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Ô nhập hiển thị */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "flex items-center h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold transition-all cursor-pointer",
          "hover:bg-slate-100/60 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10",
          isOpen && "border-indigo-500 bg-white ring-4 ring-indigo-500/10",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          disabled={disabled}
          placeholder={placeholder}
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 font-semibold text-sm cursor-pointer"
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            title="Xóa ngày"
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors mr-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0 pointer-events-none" />
      </div>

      {/* Popover Lịch tùy biến */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
          {/* Header tháng / năm */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-extrabold text-sm text-slate-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tiêu đề thứ trong tuần */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((name, i) => (
              <span
                key={name}
                className={cn(
                  "text-[11px] font-bold uppercase",
                  i >= 5 ? "text-rose-500" : "text-slate-400",
                )}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Lưới các ngày */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Ngày tháng trước */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <span
                key={`prev-${i}`}
                className="h-8 flex items-center justify-center text-xs font-semibold text-slate-300 select-none"
              >
                {prevMonthDays - startOffset + i + 1}
              </span>
            ))}

            {/* Ngày trong tháng */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const isSelected =
                viewYear === selectedYear &&
                viewMonth === selectedMonth &&
                d === selectedDay;
              const isToday = isCurrentMonth && d === todayDate;

              return (
                <button
                  key={d}
                  type="button"
                  disabled={
                    !isSelectable(
                      `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                    )
                  }
                  onClick={() => handleSelectDay(d)}
                  className={cn(
                    "h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed",
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : isToday
                        ? "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                        : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Chân popover: Nút Hôm nay & Đóng */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleQuickToday}
              className="font-bold text-indigo-600 hover:underline"
            >
              Hôm nay
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="font-semibold text-slate-500 hover:text-rose-500 transition-colors"
              >
                Xóa chọn
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
