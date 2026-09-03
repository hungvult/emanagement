"use client";

import React, { useEffect, useState } from "react";
import { RoleGuard } from "../../../components/shared/role-guard";
import { shiftService } from "../../../services/shift.service";
import { employeeService } from "../../../services/employee.service";
import { ShiftResponse, ShiftCreate, AssignShift } from "../../../types/shift.types";
import { EmployeeResponse } from "../../../types/employee.types";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import { useToast } from "../../../components/ui/toast";
import { Plus, Clock, UserCheck, Calendar } from "lucide-react";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error, success } = useToast();

  // Create Shift Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ShiftCreate>({
    name: "",
    startTime: "08:00:00",
    endTime: "17:30:00",
    gracePeriodMinutes: 15,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Assign Shift Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    userId: string;
    shiftId: string;
    assignedDate: string;
  }>({
    userId: "",
    shiftId: "",
    assignedDate: new Date().toISOString().split("T")[0],
  });
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const res = await shiftService.getAll();
      if (res.status === "SUCCESS" && res.data) {
        setShifts(res.data);
      }
    } catch (err: any) {
      error("Lỗi khi tải danh sách ca làm việc");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const res = await employeeService.getAll(0, 100);
      if (res.status === "SUCCESS" && res.data) {
        setEmployees(res.data.content);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách nhân viên cho phân ca");
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchEmployeesList();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      error("Tên ca làm việc không được để trống");
      return;
    }

    setIsCreating(true);
    try {
      const payload: ShiftCreate = {
        name: createForm.name,
        startTime: createForm.startTime.length === 5 ? `${createForm.startTime}:00` : createForm.startTime,
        endTime: createForm.endTime.length === 5 ? `${createForm.endTime}:00` : createForm.endTime,
        gracePeriodMinutes: Number(createForm.gracePeriodMinutes) || 0,
      };

      const res = await shiftService.create(payload);
      if (res.status === "SUCCESS") {
        success("Tạo mới ca làm việc thành công!");
        setIsCreateOpen(false);
        setCreateForm({
          name: "",
          startTime: "08:00:00",
          endTime: "17:30:00",
          gracePeriodMinutes: 15,
        });
        fetchShifts();
      } else {
        error(res.message || "Không thể tạo ca làm việc");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi tạo ca làm việc");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftId || !assignForm.assignedDate) {
      error("Vui lòng chọn đầy đủ nhân viên, ca làm việc và ngày phân ca");
      return;
    }

    setIsAssigning(true);
    try {
      const payload: AssignShift = {
        userId: Number(assignForm.userId),
        shiftId: Number(assignForm.shiftId),
        assignedDate: assignForm.assignedDate,
      };

      const res = await shiftService.assign(payload);
      if (res.status === "SUCCESS") {
        success("Phân ca làm việc cho nhân viên thành công!");
        setIsAssignOpen(false);
      } else {
        error(res.message || "Không thể phân ca");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi phân ca");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]} fallback={<p>Không có quyền truy cập</p>}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Quản lý Ca làm việc</h1>
            <p className="text-text-secondary">Tạo danh mục ca làm việc và phân bổ lịch trực cho nhân sự.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsAssignOpen(true)}
              className="flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" /> Phân ca cho NV
            </Button>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Tạo ca mới
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse flex gap-4 w-full flex-wrap">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 w-full md:w-1/3 bg-bg-tertiary rounded-md" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shifts.length === 0 ? (
              <p className="col-span-full text-text-secondary">Chưa có dữ liệu ca làm việc.</p>
            ) : (
              shifts.map((shift) => (
                <Card key={shift.id} className="hover:border-accent/50 transition-colors shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg text-text-primary">{shift.name}</CardTitle>
                      <Badge variant="outline">{shift.shiftCode}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 text-text-secondary">
                      <div className="bg-bg-tertiary p-2 rounded-full">
                        <Clock className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">
                          {shift.startTime} - {shift.endTime}
                        </span>
                        <span className="text-sm text-text-secondary">
                          Cho phép trễ tối đa: <strong>{shift.gracePeriodMinutes}</strong> phút
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Modal Tạo ca làm việc mới */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Tạo ca làm việc mới"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Tên ca làm việc *"
              placeholder="VD: Ca Hành Chính, Ca Sáng, Ca Tối"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Giờ bắt đầu *"
                type="time"
                step="1"
                value={createForm.startTime}
                onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                required
              />
              <Input
                label="Giờ kết thúc *"
                type="time"
                step="1"
                value={createForm.endTime}
                onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                required
              />
            </div>
            <Input
              label="Số phút cho phép đi trễ (0 - 120 phút)"
              type="number"
              min="0"
              max="120"
              value={createForm.gracePeriodMinutes}
              onChange={(e) => setCreateForm({ ...createForm, gracePeriodMinutes: Number(e.target.value) })}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isCreating}>
                Tạo ca làm việc
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Phân ca cho nhân viên */}
        <Modal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          title="Phân ca làm việc cho nhân viên"
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">Chọn nhân viên *</label>
              <select
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                value={assignForm.userId}
                onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                required
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">Chọn ca làm việc *</label>
              <select
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                value={assignForm.shiftId}
                onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                required
              >
                <option value="">-- Chọn ca làm việc --</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.startTime} - {shift.endTime})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Ngày phân ca *"
              type="date"
              value={assignForm.assignedDate}
              onChange={(e) => setAssignForm({ ...assignForm, assignedDate: e.target.value })}
              required
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAssignOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isAssigning}>
                Xác nhận phân ca
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </RoleGuard>
  );
}

