"use client";
import { RoleGuard } from "@/components/shared/role-guard";
import { AssignShiftDialog } from "@/components/shifts/assign-shift-dialog";
import { BulkAssignDialog } from "@/components/shifts/bulk-assign-dialog";
import { CopyWeekDialog } from "@/components/shifts/copy-week-dialog";
import { RemoveAssignmentDialog } from "@/components/shifts/remove-assignment-dialog";
import { ScheduleGrid } from "@/components/shifts/schedule-grid";
import { ShiftCatalog } from "@/components/shifts/shift-catalog";
import { ShiftCreateDialog } from "@/components/shifts/shift-create-dialog";
import { ShiftDeleteDialog } from "@/components/shifts/shift-delete-dialog";
import { ShiftEditDialog } from "@/components/shifts/shift-edit-dialog";
import { ShiftToolbar } from "@/components/shifts/shift-toolbar";
import { useShifts } from "@/hooks/shifts/use-shifts";

export default function ShiftsPage() {
  return (
    <RoleGuard
      allowedRoles={["ROLE_ADMIN"]}
      fallback={<p>Không có quyền truy cập</p>}
    >
      <ShiftManagement />
    </RoleGuard>
  );
}

function ShiftManagement() {
  const model = useShifts();
  return (
    <div className="space-y-8">
      <ShiftToolbar
        handleOpenCopyWeek={model.handleOpenCopyWeek}
        handleOpenBulk={model.handleOpenBulk}
        setIsAssignOpen={model.setIsAssignOpen}
        setIsCreateOpen={model.setIsCreateOpen}
      />
      <ShiftCatalog
        shifts={model.shifts}
        includeInactive={model.includeInactive}
        setIncludeInactive={model.setIncludeInactive}
        handleOpenEdit={model.handleOpenEdit}
        handleOpenDelete={model.handleOpenDelete}
      />
      <ScheduleGrid
        weekLabel={model.weekLabel}
        setWeekStart={model.setWeekStart}
        weekDays={model.weekDays}
        today={model.today}
        isLoadingSchedule={model.isLoadingSchedule}
        displayEmployees={model.displayEmployees}
        scheduleMap={model.scheduleMap}
        shiftColorMap={model.shiftColorMap}
        handleCellClick={model.handleCellClick}
        setConfirmRemove={model.setConfirmRemove}
      />
      <ShiftCreateDialog
        isCreateOpen={model.isCreateOpen}
        setIsCreateOpen={model.setIsCreateOpen}
        handleCreateSubmit={model.handleCreateSubmit}
        createForm={model.createForm}
        setCreateForm={model.setCreateForm}
        isCreating={model.isCreating}
      />
      <ShiftEditDialog
        isEditOpen={model.isEditOpen}
        setIsEditOpen={model.setIsEditOpen}
        handleEditSubmit={model.handleEditSubmit}
        editForm={model.editForm}
        setEditForm={model.setEditForm}
        isUpdating={model.isUpdating}
      />
      <ShiftDeleteDialog
        isDeleteShiftOpen={model.isDeleteShiftOpen}
        setIsDeleteShiftOpen={model.setIsDeleteShiftOpen}
        deletingShift={model.deletingShift}
        handleDeleteShiftSubmit={model.handleDeleteShiftSubmit}
        replaceShiftId={model.replaceShiftId}
        setReplaceShiftId={model.setReplaceShiftId}
        shifts={model.shifts}
        isDeletingShift={model.isDeletingShift}
      />
      <AssignShiftDialog
        isAssignOpen={model.isAssignOpen}
        setIsAssignOpen={model.setIsAssignOpen}
        setOverwriteWarning={model.setOverwriteWarning}
        handleAssignSubmit={model.handleAssignSubmit}
        assignForm={model.assignForm}
        setAssignForm={model.setAssignForm}
        activeEmployees={model.activeEmployees}
        activeShiftsForAssign={model.activeShiftsForAssign}
        overwriteWarning={model.overwriteWarning}
        isAssigning={model.isAssigning}
      />
      <BulkAssignDialog
        isBulkOpen={model.isBulkOpen}
        setIsBulkOpen={model.setIsBulkOpen}
        bulkForm={model.bulkForm}
        setBulkForm={model.setBulkForm}
        setBulkResult={model.setBulkResult}
        activeShiftsForAssign={model.activeShiftsForAssign}
        toggleBulkDay={model.toggleBulkDay}
        activeEmployees={model.activeEmployees}
        toggleBulkUser={model.toggleBulkUser}
        bulkResult={model.bulkResult}
        isBulkPreviewing={model.isBulkPreviewing}
        executeBulkAssign={model.executeBulkAssign}
        isBulkSubmitting={model.isBulkSubmitting}
      />
      <CopyWeekDialog
        isCopyWeekOpen={model.isCopyWeekOpen}
        setIsCopyWeekOpen={model.setIsCopyWeekOpen}
        copyWeekForm={model.copyWeekForm}
        setCopyWeekForm={model.setCopyWeekForm}
        setCopyResult={model.setCopyResult}
        activeEmployees={model.activeEmployees}
        copyResult={model.copyResult}
        isCopyPreviewing={model.isCopyPreviewing}
        executeCopyWeek={model.executeCopyWeek}
        isCopySubmitting={model.isCopySubmitting}
      />
      <RemoveAssignmentDialog
        confirmRemove={model.confirmRemove}
        setConfirmRemove={model.setConfirmRemove}
        isRemoving={model.isRemoving}
        handleRemoveShift={model.handleRemoveShift}
      />
    </div>
  );
}
