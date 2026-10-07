"use client";
import NextImage from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/utils";
import { attendanceService } from "@/services/attendance.service";
import {
  DashboardOverview,
  dashboardService,
} from "@/services/dashboard.service";
import { AttendanceHistory } from "@/types/attendance.types";
import {
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  const [recentAttendance, setRecentAttendance] = useState<AttendanceHistory[]>(
    [],
  );
  const [selectedRecord, setSelectedRecord] =
    useState<AttendanceHistory | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isAdmin) {
          setIsLoadingOverview(true);
          const res = await dashboardService.getOverview();
          if (res.status === "SUCCESS" && res.data) {
            setOverview(res.data);
          }
        } else if (user) {
          const attRes = await attendanceService.getMyHistory(user.id, 0, 5);
          if (attRes.status === "SUCCESS" && attRes.data) {
            setRecentAttendance(attRes.data.content || []);
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu dashboard", error);
      } finally {
        setIsLoadingOverview(false);
      }
    };

    fetchData();
  }, [isAdmin, user]);

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
                      bgLight: "bg-emerald-50",
                    },
                    {
                      label: "Đi muộn",
                      value: overview.lateToday,
                      color: "bg-amber-500",
                      bgLight: "bg-amber-50",
                    },
                    {
                      label: "Nghỉ phép",
                      value: overview.onLeaveToday,
                      color: "bg-violet-500",
                      bgLight: "bg-violet-50",
                    },
                    {
                      label: "Vắng mặt",
                      value: overview.absentToday,
                      color: "bg-rose-500",
                      bgLight: "bg-rose-50",
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
                  {recentAttendance.map((record) => (
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
                          variant={
                            record.status === "ON_TIME"
                              ? "success"
                              : record.status === "LATE"
                                ? "warning"
                                : "danger"
                          }
                          className="px-2.5 py-1 text-xs shadow-sm"
                        >
                          {record.status === "ON_TIME"
                            ? "Đúng giờ"
                            : record.status === "LATE"
                              ? "Đi muộn"
                              : "Về sớm"}
                        </Badge>
                        {(record.snapshotUrl || record.checkoutSnapshotUrl) && (
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
                  ))}
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
              <span className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                Trạm:{" "}
                <strong className="text-slate-900">
                  {selectedRecord.kioskName}
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
