"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Users, Clock, FileText, AlertTriangle } from "lucide-react";
import { employeeService } from "../../../services/employee.service";
import { attendanceService } from "../../../services/attendance.service";
import { leaveService } from "../../../services/leave.service";
import { alertService } from "../../../services/alert.service";
import { formatDateTime } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");

  const [stats, setStats] = useState({
    totalEmployees: 0,
    checkInsToday: 0,
    pendingLeaves: 0,
    unresolvedAlerts: 0,
  });

  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (isAdmin) {
          // Fetch Admin Stats using totalElement
          const [empRes, attRes, leaveRes, alertRes] = await Promise.all([
            employeeService.getAll(0, 1),
            attendanceService.getAllRecords(0, 1),
            leaveService.getAll(0, 1, "PENDING"),
            alertService.getAll(0, 1, false)
          ]);

          setStats({
            totalEmployees: (empRes.status === "SUCCESS" && empRes.data) ? empRes.data.totalElement : 0,
            checkInsToday: (attRes.status === "SUCCESS" && attRes.data) ? attRes.data.totalElement : 0,
            pendingLeaves: (leaveRes.status === "SUCCESS" && leaveRes.data) ? leaveRes.data.totalElement : 0,
            unresolvedAlerts: (alertRes.status === "SUCCESS" && alertRes.data) ? alertRes.data.totalElement : 0,
          });
        } else if (user) {
          // Fetch User Data
          const attRes = await attendanceService.getMyHistory(user.id, 0, 5);
          if (attRes.status === "SUCCESS" && attRes.data) {
            setRecentAttendance(attRes.data.content || []);
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu dashboard", error);
      }
    };

    fetchDashboardData();
  }, [isAdmin, user]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Xin chào, {user?.fullName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chào mừng bạn quay lại hệ thống eManagement.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng nhân viên</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5 relative z-10">
                <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalEmployees}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lượt chấm công</CardTitle>
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="pb-5 relative z-10">
                <div className="text-3xl font-bold text-foreground tracking-tight">{stats.checkInsToday}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Đơn phép chờ</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <FileText className="h-4 w-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent className="pb-5 relative z-10">
                <div className="text-3xl font-bold text-foreground tracking-tight">{stats.pendingLeaves}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-destructive/10 blur-2xl group-hover:bg-destructive/20 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cảnh báo chưa xử lý</CardTitle>
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent className="pb-5 relative z-10">
                <div className="text-3xl font-bold text-foreground tracking-tight">{stats.unresolvedAlerts}</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border pb-3 pt-4">
              <CardTitle className="text-base font-semibold text-foreground">Chấm công gần đây</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0 hover:bg-muted/50 p-2 rounded-md transition-colors -mx-2 px-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {record.kioskName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Vào: {formatDateTime(record.checkInTime) || "--"} • Ra: {formatDateTime(record.checkOutTime) || "--"}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          record.status === 'ON_TIME' ? 'success' : 
                          record.status === 'LATE' ? 'warning' : 'danger'
                        }
                      >
                        {record.status}
                      </Badge>
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
    </div>
  );
}
