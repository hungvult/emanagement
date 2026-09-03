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
      <div className="flex justify-between items-end bg-bg-secondary/40 backdrop-blur-xl p-4 rounded-xl border border-white/5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Xin chào, {user?.fullName}!
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Chào mừng bạn quay lại hệ thống eManagement.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden group border-white/5">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-accent/20 blur-xl group-hover:bg-accent/30 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 relative z-10">
                <CardTitle className="text-xs font-medium text-text-secondary">Tổng nhân viên</CardTitle>
                <div className="p-1.5 bg-accent/10 rounded-md">
                  <Users className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="pb-4 relative z-10">
                <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.totalEmployees}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group border-white/5">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-success/20 blur-xl group-hover:bg-success/30 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 relative z-10">
                <CardTitle className="text-xs font-medium text-text-secondary">Lượt chấm công</CardTitle>
                <div className="p-1.5 bg-success/10 rounded-md">
                  <Clock className="h-4 w-4 text-success" />
                </div>
              </CardHeader>
              <CardContent className="pb-4 relative z-10">
                <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.checkInsToday}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group border-white/5">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-warning/20 blur-xl group-hover:bg-warning/30 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 relative z-10">
                <CardTitle className="text-xs font-medium text-text-secondary">Đơn phép chờ</CardTitle>
                <div className="p-1.5 bg-warning/10 rounded-md">
                  <FileText className="h-4 w-4 text-warning" />
                </div>
              </CardHeader>
              <CardContent className="pb-4 relative z-10">
                <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.pendingLeaves}</div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group border-white/5">
              <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-danger/20 blur-xl group-hover:bg-danger/30 transition-all"></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 relative z-10">
                <CardTitle className="text-xs font-medium text-text-secondary">Cảnh báo chưa xử lý</CardTitle>
                <div className="p-1.5 bg-danger/10 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                </div>
              </CardHeader>
              <CardContent className="pb-4 relative z-10">
                <div className="text-2xl font-bold text-text-primary tracking-tight">{stats.unresolvedAlerts}</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-white/5">
            <CardHeader className="border-b border-white/5 pb-3 pt-4">
              <CardTitle className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">Chấm công gần đây</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0 hover:bg-white/[0.02] p-1.5 rounded-md transition-colors -mx-1.5 px-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-bg-tertiary rounded-md border border-white/5 shadow-inner">
                          <Clock className="h-3.5 w-3.5 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {record.kioskName}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
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
                  <Clock className="h-10 w-10 text-text-secondary/30 mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">Chưa có dữ liệu chấm công.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
