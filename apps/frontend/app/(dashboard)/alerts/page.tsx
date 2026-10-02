"use client";

import React, { useEffect, useState } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { useAuth } from "../../../hooks/use-auth";
import { alertService } from "../../../services/alert.service";
import { AnomalyAlert } from "../../../types/alert.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "UNRESOLVED">("UNRESOLVED");
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

  const fetchAlerts = async (pageNumber: number, currentFilter: string) => {
    setIsLoading(true);
    try {
      const isResolved = currentFilter === "ALL" ? undefined : false;
      const res = await alertService.getAll(pageNumber, 15, isResolved);
      
      if (res.status === "SUCCESS" && res.data) {
        setAlerts(res.data.content || []);
        setTotalPages(res.data.totalPages || 1);
        setPage(res.data.pageNumber || 0);
      }
    } catch (err: any) {
      error("Lỗi khi tải danh sách cảnh báo");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(page, filter);
  }, [page, filter]);

  const handleResolve = async (id: number) => {
    if (!user) return;
    try {
      const res = await alertService.resolve(id, { resolvedByUserId: user.id });
      if (res.status === "SUCCESS") {
        success("Đã xử lý và đóng cảnh báo thành công");
        fetchAlerts(page, filter);
      } else {
        error(res.message || "Không thể xử lý cảnh báo");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi xử lý cảnh báo");
    }
  };

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-rose-50/80 via-white to-white p-6 rounded-[32px] border border-rose-100/50 shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
              Cảnh báo bất thường AI
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
              Giám sát các hành vi bất thường, giả mạo eKYC hoặc chấm công sai quy chế.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant={filter === "UNRESOLVED" ? "default" : "outline"}
              onClick={() => { setFilter("UNRESOLVED"); setPage(0); }}
              className={`flex items-center gap-2 h-11 px-5 rounded-xl font-bold transition-all ${
                filter === "UNRESOLVED" 
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 border-transparent" 
                  : "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              }`}
            >
              <AlertTriangle className="h-4 w-4" /> Chưa xử lý
            </Button>
            <Button 
              variant={filter === "ALL" ? "default" : "outline"}
              onClick={() => { setFilter("ALL"); setPage(0); }}
              className={`flex items-center gap-2 h-11 px-5 rounded-xl font-bold transition-all ${
                filter === "ALL" 
                  ? "bg-slate-800 hover:bg-slate-900 text-white shadow-md shadow-slate-500/20 border-transparent" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200"
              }`}
            >
              <ShieldCheck className="h-4 w-4" /> Tất cả
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse space-y-4 w-full">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-md" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày cảnh báo</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Loại cảnh báo</TableHead>
                  <TableHead>Mô tả sự cố</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Không có cảnh báo nào
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => (
                    <TableRow key={alert.id} className={!alert.isResolved ? "bg-danger/5" : ""}>
                      <TableCell className="whitespace-nowrap font-medium">{alert.alertDate}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{alert.fullName}</div>
                        <div className="text-xs text-muted-foreground">{alert.employeeCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={!alert.isResolved ? "text-danger border-danger/30 bg-danger/10" : ""}>
                          {alert.alertType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] lg:max-w-[300px] truncate" title={alert.description}>{alert.description}</TableCell>
                      <TableCell>
                        {alert.isResolved ? (
                          <div className="flex flex-col">
                            <Badge variant="success" className="w-fit">Đã xử lý</Badge>
                            {alert.resolvedByName && (
                              <span className="text-[11px] text-muted-foreground mt-1">bởi {alert.resolvedByName}</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="danger" className="w-fit">Chưa xử lý</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!alert.isResolved && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors w-full sm:w-auto ml-auto"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Xác nhận xử lý
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <Pagination 
                pageNumber={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}

