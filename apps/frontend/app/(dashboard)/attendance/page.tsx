"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { attendanceService } from "../../../services/attendance.service";
import { AttendanceHistory } from "../../../types/attendance.types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { Pagination } from "../../../components/ui/pagination";
import { useToast } from "../../../components/ui/toast";
import { formatDateTime } from "../../../lib/utils";
import { Image as ImageIcon, Eye } from "lucide-react";

export default function AttendancePage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ROLE_ADMIN");
  
  const [records, setRecords] = useState<AttendanceHistory[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const { error } = useToast();

  const fetchRecords = async (pageNumber: number) => {
    setIsLoading(true);
    try {
      let res;
      if (isAdmin) {
        res = await attendanceService.getAllRecords(pageNumber, 15);
      } else if (user) {
        res = await attendanceService.getMyHistory(user.id, pageNumber, 15);
      }

      if (res && res.status === "SUCCESS" && res.data) {
        setRecords(res.data.content);
        setTotalPages(res.data.totalPages);
        setPage(res.data.pageNumber);
      }
    } catch (err: any) {
      error("Lỗi khi tải dữ liệu chấm công");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecords(page);
    }
  }, [page, user, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">
            {isAdmin ? "Nhật ký chấm công" : "Lịch sử chấm công của tôi"}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {isAdmin ? "Xem và quản lý dữ liệu check-in/out của toàn bộ nhân viên." : "Theo dõi thời gian làm việc của bạn."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse space-y-4 w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-bg-tertiary rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Nhân viên</TableHead>}
                <TableHead>Trạm Kiosk</TableHead>
                <TableHead>Thời gian Vào</TableHead>
                <TableHead>Thời gian Ra</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hình ảnh bằng chứng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-text-secondary">
                    Không có dữ liệu chấm công
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium text-text-primary">{record.fullName}</div>
                        <div className="text-xs text-text-secondary">{record.employeeCode}</div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{record.kioskName}</TableCell>
                    <TableCell>{record.checkInTime ? formatDateTime(record.checkInTime) : "—"}</TableCell>
                    <TableCell>{record.checkOutTime ? formatDateTime(record.checkOutTime) : "—"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          record.status === 'ON_TIME' ? 'success' : 
                          record.status === 'LATE' ? 'warning' : 'danger'
                        }
                      >
                        {record.status === 'ON_TIME' ? 'Đúng giờ' :
                         record.status === 'LATE' ? 'Đi muộn' :
                         record.status === 'EARLY_LEAVE' ? 'Về sớm' : record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.snapshotUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewSnapshot(record.snapshotUrl)}
                          className="text-accent hover:bg-accent/10 flex items-center gap-1 h-7 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" /> Xem ảnh
                        </Button>
                      ) : (
                        <span className="text-text-secondary text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination 
            pageNumber={page} 
            totalPages={totalPages} 
            onPageChange={setPage} 
          />
        </>
      )}

      {/* Modal Preview Snapshot */}
      <Modal
        isOpen={!!previewSnapshot}
        onClose={() => setPreviewSnapshot(null)}
        title="Ảnh chụp nhận diện từ camera trạm Kiosk"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="relative aspect-video w-full rounded-lg bg-bg-tertiary overflow-hidden border border-border flex items-center justify-center">
            {previewSnapshot ? (
              <img src={previewSnapshot} alt="Snapshot Kiosk" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="h-12 w-12 text-text-secondary" />
            )}
          </div>
          <p className="text-xs text-text-secondary text-center">
            Đường dẫn snapshot: <code className="bg-bg-tertiary px-1 py-0.5 rounded">{previewSnapshot}</code>
          </p>
          <Button variant="secondary" onClick={() => setPreviewSnapshot(null)}>
            Đóng
          </Button>
        </div>
      </Modal>
    </div>
  );
}

