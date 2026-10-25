"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { attendanceService } from "@/services/attendance.service";
import {
  DashboardDailyTrend,
  DashboardOverview,
  dashboardService,
} from "@/services/dashboard.service";
import { AttendanceHistory } from "@/types/attendance.types";
import {
  ArrowRight,
  Calendar,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

type TrendPreset = "7D" | "14D" | "30D" | "CUSTOM";

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: "7D" | "14D" | "30D"): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const end = toLocalDateString(now);
  const days = preset === "7D" ? 6 : preset === "14D" ? 13 : 29;
  const past = new Date(now);
  past.setDate(past.getDate() - days);
  const start = toLocalDateString(past);
  return { startDate: start, endDate: end };
}

function getStatusBadge(status?: string | null) {
  switch (status) {
    case "ON_TIME":
      return { label: "Đúng giờ", variant: "success" as const };
    case "LATE":
      return { label: "Đi muộn", variant: "warning" as const };
    case "EARLY_LEAVE":
      return { label: "Về sớm", variant: "danger" as const };
    case "NO_DATA":
      return { label: "Chưa vào ca", variant: "secondary" as const };
    default:
      return { label: status || "—", variant: "secondary" as const };
  }
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");
  const toast = useToast();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  // ST2-02 & ST2-03: Trends state & range presets
  const [trends, setTrends] = useState<DashboardDailyTrend[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [preset, setPreset] = useState<TrendPreset>("7D");
  const [trendStartDate, setTrendStartDate] = useState<string>(
    () => getPresetRange("7D").startDate,
  );
  const [trendEndDate, setTrendEndDate] = useState<string>(
    () => getPresetRange("7D").endDate,
  );
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(
    null,
  );
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(
    null,
  );

  // ST2-01: Live feed attendance state
  const [recentAttendance, setRecentAttendance] = useState<AttendanceHistory[]>(
    [],
  );
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<AttendanceHistory | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      const res = await dashboardService.getOverview();
      if (res.status === "SUCCESS" && res.data) {
        setOverview(res.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu tổng quan dashboard", error);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const fetchTrends = useCallback(
    async (startDate?: string, endDate?: string) => {
      try {
        setIsLoadingTrends(true);
        const res = await dashboardService.getTrends(startDate, endDate);
        if (res.status === "SUCCESS" && res.data) {
          setTrends(res.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu xu hướng", error);
      } finally {
        setIsLoadingTrends(false);
      }
    },
    [],
  );

  const fetchRecentAttendance = useCallback(async () => {
    try {
      setIsLoadingAttendance(true);
      if (isAdmin) {
        const res = await attendanceService.getAllRecords(0, 8);
        if (res.status === "SUCCESS" && res.data) {
          setRecentAttendance(res.data.content || []);
        }
      } else if (user) {
        const res = await attendanceService.getMyHistory(user.id, 0, 5);
        if (res.status === "SUCCESS" && res.data) {
          setRecentAttendance(res.data.content || []);
        }
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu chấm công gần đây", error);
    } finally {
      setIsLoadingAttendance(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOverview();
      const initialRange = getPresetRange("7D");
      fetchTrends(initialRange.startDate, initialRange.endDate);
      fetchRecentAttendance();
    } else if (user) {
      fetchRecentAttendance();
    }
  }, [isAdmin, user, fetchOverview, fetchTrends, fetchRecentAttendance]);

  const handlePresetChange = (nextPreset: TrendPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "CUSTOM") {
      const range = getPresetRange(nextPreset);
      setTrendStartDate(range.startDate);
      setTrendEndDate(range.endDate);
      fetchTrends(range.startDate, range.endDate);
    }
  };

  const handleApplyCustomTrend = () => {
    if (trendStartDate && trendEndDate && trendStartDate > trendEndDate) {
      toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }
    fetchTrends(trendStartDate, trendEndDate);
  };

  // ST2-02: 3 chỉ số tổng hợp của giai đoạn đang chọn
  const trendSummary = useMemo(() => {
    let totalPresent = 0;
    let totalOnTime = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalAbsent = 0;

    for (const item of trends) {
      totalPresent += item.presentCount || 0;
      totalOnTime += item.onTimeCount || 0;
      totalLate += item.lateCount || 0;
      totalLeave += item.onLeaveCount || 0;
      totalAbsent += item.absentCount || 0;
    }

    const avgOnTimeRate =
      totalPresent > 0 ? Math.round((totalOnTime / totalPresent) * 100) : 0;

    return {
      totalPresent,
      totalOnTime,
      totalLate,
      totalLeave,
      totalAbsent,
      avgOnTimeRate,
    };
  }, [trends]);

  const statCards = overview
    ? [
        {
          title: "Tổng nhân viên",
          value: overview.totalEmployees,
          icon: Users,
          bg: "bg-indigo-50",
          text: "text-indigo-600",
          glow: "bg-indigo-100/50",
        },
        {
          title: "Có mặt hôm nay",
          value: overview.presentToday,
          icon: UserCheck,
          bg: "bg-emerald-50",
          text: "text-emerald-600",
          glow: "bg-emerald-100/50",
        },
        {
          title: "Đi muộn hôm nay",
          value: overview.lateToday,
          icon: Clock,
          bg: "bg-amber-50",
          text: "text-amber-600",
          glow: "bg-amber-100/50",
        },
        {
          title: "Vắng mặt hôm nay",
          value: overview.absentToday,
          icon: UserX,
          bg: "bg-rose-50",
          text: "text-rose-600",
          glow: "bg-rose-100/50",
        },
        {
          title: "Đang nghỉ phép",
          value: overview.onLeaveToday,
          icon: FileText,
          bg: "bg-violet-50",
          text: "text-violet-600",
          glow: "bg-violet-100/50",
        },
      ]
    : [];

  const activeTrendIndex = hoveredTrendIndex ?? selectedTrendIndex;
  const activeTrendDay =
    activeTrendIndex !== null && trends[activeTrendIndex]
      ? trends[activeTrendIndex]
      : null;

  // Chart dimensions & calculations
  const chartHeight = 240;
  const padTop = 20;
  const padBottom = 35;
  const padLeft = 40;
  const padRight = 20;
  const plotH = chartHeight - padTop - padBottom; // 185
  const minPlotW = Math.max(560, trends.length * 44);
  const totalChartW = padLeft + minPlotW + padRight;

  const rawMax = Math.max(
    1,
    ...trends.map((t) =>
      Math.max(
        t.totalEmployees || 0,
        (t.onTimeCount || 0) +
          (t.lateCount || 0) +
          (t.onLeaveCount || 0) +
          (t.absentCount || 0),
      ),
    ),
  );
  const gridMax = Math.max(5, Math.ceil(rawMax / 5) * 5);

  const trendPolylinePoints = trends
    .map((item, i) => {
      const colW = minPlotW / Math.max(1, trends.length);
      const cx = padLeft + i * colW + colW / 2;
      const present =
        item.presentCount ?? (item.onTimeCount || 0) + (item.lateCount || 0);
      const rate = present > 0 ? (item.onTimeCount || 0) / present : 0;
      const cy = padTop + plotH - rate * plotH;
      return `${cx},${cy}`;
    })
    .join(" ");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="relative overflow-hidden bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Xin chào,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              {user?.fullName}
            </span>
            ! 👋
          </h1>
          <p className="text-base text-slate-500 font-medium max-w-xl">
            {isAdmin
              ? "Dưới đây là tổng quan nhanh về hoạt động điểm danh và nhân sự trong ngày hôm nay."
              : "Chào mừng bạn quay lại! Bạn có thể xem lịch sử chấm công gần nhất của mình tại đây."}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Stat Cards */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {isLoadingOverview
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-3xl bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))
              : statCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <Card
                      key={card.title}
                      className="relative overflow-hidden rounded-[24px] border-slate-100 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 duration-300 group"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div
                        className={`absolute -right-4 -top-4 h-24 w-24 rounded-full ${card.glow} blur-xl group-hover:scale-150 transition-transform duration-500`}
                      />
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6 px-6 relative z-10">
                        <CardTitle className="text-sm font-semibold text-slate-500">
                          {card.title}
                        </CardTitle>
                        <div
                          className={`p-2.5 ${card.bg} rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300`}
                        >
                          <Icon className={`h-5 w-5 ${card.text}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="pb-6 px-6 relative z-10">
                        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
                          {card.value}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {/* Tỉ lệ attendance hôm nay */}
          {overview && overview.totalEmployees > 0 && (
            <Card className="border-slate-100 bg-white shadow-sm rounded-[24px] overflow-hidden">
              <CardHeader className="border-b border-slate-50/50 pb-4 pt-6 px-6 bg-slate-50/50">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                  Tỉ lệ chấm công hôm nay
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-6">
                <div className="space-y-5">
                  {[
                    {
                      label: "Có mặt",
                      value: overview.presentToday,
                      color: "bg-emerald-500",
                    },
                    {
                      label: "Đi muộn",
                      value: overview.lateToday,
                      color: "bg-amber-500",
                    },
                    {
                      label: "Nghỉ phép",
                      value: overview.onLeaveToday,
                      color: "bg-violet-500",
                    },
                    {
                      label: "Vắng mặt",
                      value: overview.absentToday,
                      color: "bg-rose-500",
                    },
                  ].map((item) => {
                    const percent =
                      overview.totalEmployees > 0
                        ? Math.round(
                            (item.value / overview.totalEmployees) * 100,
                          )
                        : 0;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-4 group"
                      >
                        <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">
                          {item.label}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden shadow-inner relative">
                          <div
                            className={`absolute top-0 left-0 h-full rounded-full ${item.color} transition-all duration-1000 ease-out`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900 w-16 text-right flex-shrink-0">
                          {item.value}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            ({percent}%)
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ST2-02 & ST2-03: Biểu đồ xu hướng chấm công & Bộ lọc ngày */}
          <Card className="border-slate-100 bg-white shadow-sm rounded-[24px] overflow-hidden">
            <CardHeader className="border-b border-slate-50/50 pb-5 pt-6 px-6 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                    Xu hướng chấm công
                  </CardTitle>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Biểu đồ phân bổ nhân sự và tỉ lệ đúng giờ theo ngày
                  </p>
                </div>

                {/* ST2-03: Bộ lọc ngày & các preset */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/60 shadow-inner">
                    {(
                      [
                        { key: "7D", label: "7 ngày qua" },
                        { key: "14D", label: "14 ngày qua" },
                        { key: "30D", label: "30 ngày qua" },
                        { key: "CUSTOM", label: "Tùy chọn" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handlePresetChange(opt.key)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                          preset === opt.key
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {preset === "CUSTOM" && (
                    <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                      <DatePicker
                        value={trendStartDate}
                        onChange={setTrendStartDate}
                        placeholder="Từ ngày"
                        className="w-32 h-8 text-xs"
                      />
                      <span className="text-slate-400 text-xs">—</span>
                      <DatePicker
                        value={trendEndDate}
                        onChange={setTrendEndDate}
                        placeholder="Đến ngày"
                        className="w-32 h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handleApplyCustomTrend}
                        className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
                      >
                        Áp dụng
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 pb-6 px-6 space-y-6">
              {/* ST2-02: 3 chỉ số tổng hợp của giai đoạn đang chọn */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">
                      Tỉ lệ đúng giờ trung bình (%)
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                      {trendSummary.avgOnTimeRate}%
                    </p>
                    <p className="text-[11px] font-medium text-emerald-600 mt-0.5">
                      {trendSummary.totalOnTime} / {trendSummary.totalPresent}{" "}
                      lượt có mặt
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl shadow-xs text-emerald-600">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      Tổng lượt đi muộn
                    </p>
                    <p className="text-2xl font-extrabold text-amber-700 mt-1">
                      {trendSummary.totalLate}
                    </p>
                    <p className="text-[11px] font-medium text-amber-600 mt-0.5">
                      Trong khoảng thời gian chọn
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl shadow-xs text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-100/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-violet-800">
                      Tổng lượt nghỉ phép
                    </p>
                    <p className="text-2xl font-extrabold text-violet-700 mt-1">
                      {trendSummary.totalLeave}
                    </p>
                    <p className="text-[11px] font-medium text-violet-600 mt-0.5">
                      Số ca nghỉ phép đã duyệt
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl shadow-xs text-violet-600">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Chú giải (Legend) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-xs" />
                    <span>Đúng giờ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500 shadow-xs" />
                    <span>Đi muộn</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-violet-500 shadow-xs" />
                    <span>Nghỉ phép</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500 shadow-xs" />
                    <span>Vắng mặt</span>
                  </div>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span className="w-4 h-0.5 bg-indigo-500 rounded-full inline-block" />
                    <span className="text-indigo-600 font-semibold">
                      Xu hướng đúng giờ (%)
                    </span>
                  </div>
                </div>

                {activeTrendDay ? (
                  <div className="text-xs font-semibold text-slate-700 bg-indigo-50/70 border border-indigo-100 px-3 py-1 rounded-xl">
                    Chi tiết ngày {formatDate(activeTrendDay.date)}:{" "}
                    <span className="text-emerald-600">
                      {activeTrendDay.onTimeCount} đúng giờ
                    </span>{" "}
                    •{" "}
                    <span className="text-amber-600">
                      {activeTrendDay.lateCount} muộn
                    </span>{" "}
                    •{" "}
                    <span className="text-violet-600">
                      {activeTrendDay.onLeaveCount} phép
                    </span>{" "}
                    •{" "}
                    <span className="text-rose-600">
                      {activeTrendDay.absentCount} vắng
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Di chuột hoặc bấm vào cột ngày để xem số liệu chi tiết
                  </span>
                )}
              </div>

              {/* ST2-02: Interactive SVG Stacked Bar & Trend Line */}
              {isLoadingTrends ? (
                <div className="h-[240px] rounded-2xl bg-slate-50 animate-pulse border border-slate-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-slate-400">
                    Đang tải biểu đồ xu hướng...
                  </span>
                </div>
              ) : trends.length === 0 ? (
                <div className="h-[240px] rounded-2xl bg-slate-50/50 border border-slate-100 flex flex-col items-center justify-center text-center p-6">
                  <Calendar className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">
                    Không có dữ liệu xu hướng cho khoảng thời gian này.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div style={{ minWidth: totalChartW }}>
                    <svg
                      width={totalChartW}
                      height={chartHeight}
                      className="overflow-visible select-none"
                    >
                      {/* Gridlines ngang */}
                      {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                        const val = Math.round(gridMax * ratio);
                        const y = padTop + plotH - ratio * plotH;
                        return (
                          <g key={ratio}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={padLeft + minPlotW}
                              y2={y}
                              stroke="#f1f5f9"
                              strokeWidth="1"
                              strokeDasharray={ratio > 0 ? "3 3" : undefined}
                            />
                            <text
                              x={padLeft - 8}
                              y={y + 3.5}
                              textAnchor="end"
                              className="text-[10px] fill-slate-400 font-mono"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Stacked bars cho từng ngày */}
                      {trends.map((item, i) => {
                        const colW = minPlotW / Math.max(1, trends.length);
                        const barW = Math.min(26, Math.max(10, colW * 0.5));
                        const colX = padLeft + i * colW;
                        const cx = colX + colW / 2;
                        const barX = cx - barW / 2;
                        const baseY = padTop + plotH;

                        const hOnTime =
                          ((item.onTimeCount || 0) / gridMax) * plotH;
                        const hLate = ((item.lateCount || 0) / gridMax) * plotH;
                        const hLeave =
                          ((item.onLeaveCount || 0) / gridMax) * plotH;
                        const hAbsent =
                          ((item.absentCount || 0) / gridMax) * plotH;

                        const yOnTime = baseY - hOnTime;
                        const yLate = yOnTime - hLate;
                        const yLeave = yLate - hLeave;
                        const yAbsent = yLeave - hAbsent;

                        const isHighlighted = i === activeTrendIndex;

                        return (
                          <g key={item.date} className="group">
                            {/* Cột highlight khi hover */}
                            {isHighlighted && (
                              <>
                                <rect
                                  x={colX + 2}
                                  y={padTop}
                                  width={colW - 4}
                                  height={plotH}
                                  fill="#6366f1"
                                  opacity="0.08"
                                  rx="6"
                                />
                                <line
                                  x1={cx}
                                  y1={padTop}
                                  x2={cx}
                                  y2={baseY}
                                  stroke="#6366f1"
                                  strokeWidth="1"
                                  strokeDasharray="2 2"
                                  opacity="0.4"
                                />
                              </>
                            )}

                            {/* Stacked Bars */}
                            {hOnTime > 0 && (
                              <rect
                                x={barX}
                                y={yOnTime}
                                width={barW}
                                height={hOnTime}
                                fill="#10b981"
                                rx={hLate + hLeave + hAbsent === 0 ? "3" : "1"}
                              >
                                <title>{`${formatDate(item.date).slice(0, 5)}: Đúng giờ ${item.onTimeCount}`}</title>
                              </rect>
                            )}

                            {hLate > 0 && (
                              <rect
                                x={barX}
                                y={yLate}
                                width={barW}
                                height={hLate}
                                fill="#f59e0b"
                                rx={hLeave + hAbsent === 0 ? "3" : "1"}
                              >
                                <title>{`${formatDate(item.date).slice(0, 5)}: Đi muộn ${item.lateCount}`}</title>
                              </rect>
                            )}

                            {hLeave > 0 && (
                              <rect
                                x={barX}
                                y={yLeave}
                                width={barW}
                                height={hLeave}
                                fill="#8b5cf6"
                                rx={hAbsent === 0 ? "3" : "1"}
                              >
                                <title>{`${formatDate(item.date).slice(0, 5)}: Nghỉ phép ${item.onLeaveCount}`}</title>
                              </rect>
                            )}

                            {hAbsent > 0 && (
                              <rect
                                x={barX}
                                y={yAbsent}
                                width={barW}
                                height={hAbsent}
                                fill="#f43f5e"
                                rx="3"
                              >
                                <title>{`${formatDate(item.date).slice(0, 5)}: Vắng mặt ${item.absentCount}`}</title>
                              </rect>
                            )}

                            {/* Nhãn ngày dd/MM */}
                            <text
                              x={cx}
                              y={baseY + 20}
                              textAnchor="middle"
                              className={cn(
                                "text-[11px] font-semibold transition-colors",
                                isHighlighted
                                  ? "fill-indigo-600 font-bold"
                                  : "fill-slate-500",
                              )}
                            >
                              {formatDate(item.date).slice(0, 5)}
                            </text>

                            {/* Invisible hotspot for mouse events */}
                            <rect
                              x={colX}
                              y={padTop}
                              width={colW}
                              height={plotH + padBottom}
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredTrendIndex(i)}
                              onMouseLeave={() => setHoveredTrendIndex(null)}
                              onClick={() =>
                                setSelectedTrendIndex(
                                  i === selectedTrendIndex ? null : i,
                                )
                              }
                            />
                          </g>
                        );
                      })}

                      {/* Đường xu hướng tỉ lệ đúng giờ (%) */}
                      {trends.length > 1 && (
                        <polyline
                          points={trendPolylinePoints}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="pointer-events-none drop-shadow-xs"
                        />
                      )}

                      {/* Điểm nút trên đường xu hướng */}
                      {trends.map((item, i) => {
                        const colW = minPlotW / Math.max(1, trends.length);
                        const cx = padLeft + i * colW + colW / 2;
                        const present =
                          item.presentCount ??
                          (item.onTimeCount || 0) + (item.lateCount || 0);
                        const rate =
                          present > 0 ? (item.onTimeCount || 0) / present : 0;
                        const cy = padTop + plotH - rate * plotH;
                        const isHighlighted = i === activeTrendIndex;

                        return (
                          <circle
                            key={`dot-${item.date}`}
                            cx={cx}
                            cy={cy}
                            r={isHighlighted ? "5.5" : "3.5"}
                            fill={isHighlighted ? "#6366f1" : "#ffffff"}
                            stroke="#6366f1"
                            strokeWidth="2.5"
                            className="pointer-events-none transition-all duration-150"
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ST2-01: Lịch sử chấm công gần đây (Live Feed) cho Admin */}
          <Card className="border-slate-100 bg-white shadow-sm rounded-[24px] overflow-hidden">
            <CardHeader className="border-b border-slate-50/50 pb-4 pt-6 px-6 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                    Lịch sử chấm công gần đây (Live Feed)
                  </CardTitle>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    8 lượt chấm công mới nhất ghi nhận trên toàn hệ thống
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRecentAttendance}
                    disabled={isLoadingAttendance}
                    className="h-8 gap-1.5 text-xs text-slate-600 rounded-xl border-slate-200 hover:bg-slate-50 shadow-xs"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        isLoadingAttendance && "animate-spin",
                      )}
                    />
                    Làm mới
                  </Button>
                  <Link href="/attendance">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold rounded-xl"
                    >
                      Xem tất cả
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingAttendance && recentAttendance.length === 0 ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-slate-100 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : recentAttendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 border-slate-100">
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-6">
                          Nhân viên
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-4">
                          Ca làm việc
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-4">
                          Trạm Kiosk
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-4">
                          Giờ vào
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-4">
                          Giờ ra
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-4">
                          Trạng thái
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 text-xs py-3.5 px-6 text-right">
                          Đối soát
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAttendance.map((record) => {
                        const badge = getStatusBadge(record.status);
                        return (
                          <TableRow
                            key={record.id}
                            className="hover:bg-slate-50/60 border-slate-100 transition-colors"
                          >
                            <TableCell className="py-3 px-6">
                              <div className="font-bold text-slate-900 text-sm">
                                {record.fullName || "—"}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {record.employeeCode || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                                {record.shiftName || "Ca hành chính"}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-4 text-xs font-medium text-slate-600">
                              {record.kioskName || "—"}
                            </TableCell>
                            <TableCell className="py-3 px-4 text-xs font-medium text-slate-700">
                              {formatDateTime(record.checkInTime)}
                            </TableCell>
                            <TableCell className="py-3 px-4 text-xs font-medium text-slate-700">
                              {formatDateTime(record.checkOutTime)}
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <Badge
                                variant={badge.variant}
                                className="px-2.5 py-0.5 text-xs shadow-xs"
                              >
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 px-6 text-right">
                              {record.snapshotUrl || record.checkoutSnapshotUrl ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedRecord(record)}
                                  className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 inline-flex items-center gap-1.5 h-8 text-xs font-semibold px-2.5 rounded-lg"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Xem ảnh
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  Không có ảnh
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center text-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Chưa có dữ liệu chấm công.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Nhân viên: Chấm công gần đây */
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-slate-100 bg-white shadow-sm rounded-[24px] overflow-hidden">
            <CardHeader className="border-b border-slate-50/50 pb-4 pt-6 px-6 bg-slate-50/50">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                Lịch sử chấm công gần đây
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.map((record) => {
                    const badge = getStatusBadge(record.status);
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shadow-sm">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {record.kioskName}
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2">
                              <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                                Vào: {formatDateTime(record.checkInTime) || "--"}
                              </span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                                Ra: {formatDateTime(record.checkOutTime) || "--"}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant={badge.variant}
                            className="px-2.5 py-1 text-xs shadow-sm"
                          >
                            {badge.label}
                          </Badge>
                          {(record.snapshotUrl ||
                            record.checkoutSnapshotUrl) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRecord(record)}
                              className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-1.5 h-7 text-xs font-semibold px-2 rounded-lg"
                            >
                              <Eye className="h-3.5 w-3.5" /> Xem ảnh
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center text-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Bạn chưa có dữ liệu chấm công.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Preview Snapshot */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Ảnh đối soát: ${selectedRecord?.fullName || user?.fullName || ""}`}
      >
        {selectedRecord && (
          <div className="flex flex-col space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Check In Image */}
              <div className="flex flex-col space-y-3 rounded-[20px] border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                    Vào ca (Check-in)
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    {selectedRecord.checkInTime
                      ? formatDateTime(selectedRecord.checkInTime)
                      : "—"}
                  </span>
                </div>
                <div className="relative aspect-square w-full rounded-2xl bg-slate-50 overflow-hidden border border-slate-100 flex items-center justify-center group">
                  {selectedRecord.snapshotUrl ? (
                    <NextImage
                      unoptimized
                      width={640}
                      height={480}
                      src={selectedRecord.snapshotUrl}
                      alt="Ảnh Check-in"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon className="h-10 w-10 opacity-30" />
                      <span className="text-xs font-medium">Không có ảnh</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Check Out Image */}
              <div className="flex flex-col space-y-3 rounded-[20px] border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    Ra ca (Check-out)
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    {selectedRecord.checkOutTime
                      ? formatDateTime(selectedRecord.checkOutTime)
                      : "Chưa điểm danh"}
                  </span>
                </div>
                <div className="relative aspect-square w-full rounded-2xl bg-slate-50 overflow-hidden border border-slate-100 flex items-center justify-center group">
                  {selectedRecord.checkoutSnapshotUrl ? (
                    <NextImage
                      unoptimized
                      width={640}
                      height={480}
                      src={selectedRecord.checkoutSnapshotUrl}
                      alt="Ảnh Check-out"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon className="h-10 w-10 opacity-30" />
                      <span className="text-xs font-medium">
                        {selectedRecord.checkOutTime
                          ? "Không có ảnh"
                          : "Chưa hoàn thành ca"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-5 mt-2 border-t border-slate-100">
              <span className="text-xs sm:text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                Trạm:{" "}
                <strong className="text-slate-900">
                  {selectedRecord.kioskName}
                </strong>{" "}
                | Trạng thái:{" "}
                <strong
                  className={
                    selectedRecord.status === "ON_TIME"
                      ? "text-emerald-600"
                      : selectedRecord.status === "LATE"
                        ? "text-amber-500"
                        : selectedRecord.status === "EARLY_LEAVE"
                          ? "text-rose-500"
                          : "text-slate-500"
                  }
                >
                  {getStatusBadge(selectedRecord.status).label}
                </strong>
              </span>
              <Button
                variant="outline"
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-6"
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
