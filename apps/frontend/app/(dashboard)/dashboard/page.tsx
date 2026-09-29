"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Users, Clock, FileText, AlertTriangle, UserCheck, UserX, Eye, Image as ImageIcon } from "lucide-react";
import { dashboardService, DashboardOverview } from "../../../services/dashboard.service";
import { attendanceService } from "../../../services/attendance.service";
import { formatDateTime } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { AttendanceHistory } from "../../../types/attendance.types";

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  const [recentAttendance, setRecentAttendance] = useState<AttendanceHistory[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceHistory | null>(null);

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
          color: "primary",
          bg: "bg-primary/10",
          text: "text-primary",
          glow: "bg-primary/10",
        },
        {
          title: "Có mặt hôm nay",
          value: overview.presentToday,
          icon: UserCheck,
          color: "emerald",
          bg: "bg-emerald-500/10",
          text: "text-emerald-600",
          glow: "bg-emerald-500/10",
        },
        {
          title: "Đi muộn hôm nay",
          value: overview.lateToday,
          icon: Clock,
          color: "amber",
          bg: "bg-amber-500/10",
          text: "text-amber-600",
          glow: "bg-amber-500/10",
        },
        {
          title: "Vắng mặt hôm nay",
          value: overview.absentToday,
          icon: UserX,
          color: "rose",
          bg: "bg-rose-500/10",
          text: "text-rose-600",
          glow: "bg-rose-500/10",
        },
        {
          title: "Đang nghỉ phép",
          value: overview.onLeaveToday,
          icon: FileText,
          color: "violet",
          bg: "bg-violet-500/10",
          text: "text-violet-600",
          glow: "bg-violet-500/10",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Xin chào, {user?.fullName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Đây là tổng quan hoạt động của hệ thống hôm nay."
              : "Chào mừng bạn quay lại hệ thống eManagement."}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {isLoadingOverview
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
                ))
              : statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card
                      key={card.title}
                      className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all"
                    >
                      <div
                        className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full ${card.glow} blur-2xl`}
                      />
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 relative z-10">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {card.title}
                        </CardTitle>
                        <div className={`p-2 ${card.bg} rounded-lg`}>
                          <Icon className={`h-4 w-4 ${card.text}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="pb-5 relative z-10">
                        <div className="text-3xl font-bold text-foreground tracking-tight">
                          {card.value}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {/* Tỉ lệ attendance hôm nay */}
          {overview && overview.totalEmployees > 0 && (
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border pb-3 pt-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Tỉ lệ chấm công hôm nay
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-5">
                <div className="space-y-3">
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
                        ? Math.round((item.value / overview.totalEmployees) * 100)
                        : 0;
                    return (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-20 flex-shrink-0">
                          {item.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color} transition-all duration-700`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-foreground w-12 text-right flex-shrink-0">
                          {item.value}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
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
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border pb-3 pt-4">
              <CardTitle className="text-base font-semibold text-foreground">
                Chấm công gần đây
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0 hover:bg-muted/50 p-2 rounded-md transition-colors -mx-2 px-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {record.kioskName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Vào: {formatDateTime(record.checkInTime) || "--"} • Ra:{" "}
                            {formatDateTime(record.checkOutTime) || "--"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(record.snapshotUrl || record.checkoutSnapshotUrl) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
                            className="text-accent hover:bg-accent/10 flex items-center gap-1 h-7 text-xs font-medium px-2"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem ảnh
                          </Button>
                        )}
                        <Badge
                          variant={
                            record.status === "ON_TIME"
                              ? "success"
                              : record.status === "LATE"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {record.status === "ON_TIME"
                            ? "Đúng giờ"
                            : record.status === "LATE"
                            ? "Đi muộn"
                            : "Về sớm"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm công.</p>
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
          <div className="flex flex-col space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2 rounded-xl border border-border p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Ảnh vào ca (Check-in)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedRecord.checkInTime ? formatDateTime(selectedRecord.checkInTime) : "—"}
                  </span>
                </div>
                <div className="relative aspect-video w-full rounded-lg bg-black/5 dark:bg-black/30 overflow-hidden border border-border flex items-center justify-center">
                  {selectedRecord.snapshotUrl ? (
                    <img
                      src={selectedRecord.snapshotUrl}
                      alt="Ảnh Check-in"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">Không có ảnh</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col space-y-2 rounded-xl border border-border p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Ảnh ra ca (Check-out)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedRecord.checkOutTime
                      ? formatDateTime(selectedRecord.checkOutTime)
                      : "Chưa chấm công ra"}
                  </span>
                </div>
                <div className="relative aspect-video w-full rounded-lg bg-black/5 dark:bg-black/30 overflow-hidden border border-border flex items-center justify-center">
                  {selectedRecord.checkoutSnapshotUrl ? (
                    <img
                      src={selectedRecord.checkoutSnapshotUrl}
                      alt="Ảnh Check-out"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">
                        {selectedRecord.checkOutTime ? "Không có ảnh" : "Chưa hoàn thành ca"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Trạm: <strong className="text-foreground">{selectedRecord.kioskName}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedRecord(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
