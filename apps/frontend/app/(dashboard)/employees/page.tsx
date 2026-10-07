"use client";
import { EmployeeCreateDialog } from "@/components/employees/employee-create-dialog";
import { EmployeeDetailDialog } from "@/components/employees/employee-detail-dialog";
import { EmployeeEditDialog } from "@/components/employees/employee-edit-dialog";
import { EmployeeEnrollment } from "@/components/employees/employee-enrollment";
import { EmployeeFacesDialog } from "@/components/employees/employee-faces-dialog";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { EmployeeTable } from "@/components/employees/employee-table";
import { RoleGuard } from "@/components/shared/role-guard";
import { useEmployees } from "@/hooks/employees/use-employees";

export default function EmployeesPage() {
  return (
    <RoleGuard
      allowedRoles={["ROLE_ADMIN"]}
      fallback={<p>Không có quyền truy cập</p>}
    >
      <EmployeeManagement />
    </RoleGuard>
  );
}

function EmployeeManagement() {
  const model = useEmployees();
  return (
    <div className="space-y-6">
      <EmployeeFilters
        searchTerm={model.searchTerm}
        setSearchTerm={model.setSearchTerm}
        showFilters={model.showFilters}
        setShowFilters={model.setShowFilters}
        activeFilterCount={model.activeFilterCount}
        showColumnPicker={model.showColumnPicker}
        setShowColumnPicker={model.setShowColumnPicker}
        setIsCreateOpen={model.setIsCreateOpen}
        filterStatus={model.filterStatus}
        setFilterStatus={model.setFilterStatus}
        setPage={model.setPage}
        filterFace={model.filterFace}
        setFilterFace={model.setFilterFace}
        toggleColumn={model.toggleColumn}
        columnVis={model.columnVis}
      />
      <EmployeeTable
        isLoading={model.isLoading}
        columnVis={model.columnVis}
        employees={model.employees}
        openDetailModal={model.openDetailModal}
        openFaceModal={model.openFaceModal}
        openEkycModal={model.openEkycModal}
        handleDeleteFace={model.handleDeleteFace}
        handleOpenEdit={model.handleOpenEdit}
        handleDelete={model.handleDelete}
        page={model.page}
        totalPages={model.totalPages}
        setPage={model.setPage}
        fetchEmployees={model.fetchEmployees}
      />
      <EmployeeCreateDialog
        isCreateOpen={model.isCreateOpen}
        setIsCreateOpen={model.setIsCreateOpen}
        handleCreateSubmit={model.handleCreateSubmit}
        createForm={model.createForm}
        setCreateForm={model.setCreateForm}
        isCreating={model.isCreating}
      />
      <EmployeeEditDialog
        isEditOpen={model.isEditOpen}
        setIsEditOpen={model.setIsEditOpen}
        editingEmployee={model.editingEmployee}
        handleEditSubmit={model.handleEditSubmit}
        editForm={model.editForm}
        setEditForm={model.setEditForm}
        isUpdating={model.isUpdating}
      />
      <EmployeeDetailDialog
        isDetailOpen={model.isDetailOpen}
        setIsDetailOpen={model.setIsDetailOpen}
        detailEmployee={model.detailEmployee}
        openFaceModal={model.openFaceModal}
        handleOpenEdit={model.handleOpenEdit}
      />
      <EmployeeFacesDialog
        isFaceModalOpen={model.isFaceModalOpen}
        setIsFaceModalOpen={model.setIsFaceModalOpen}
        isFaceLoading={model.isFaceLoading}
        faceImages={model.faceImages}
      />
      <EmployeeEnrollment
        isEkycOpen={model.isEkycOpen}
        setIsEkycOpen={model.setIsEkycOpen}
        ekycEmployee={model.ekycEmployee}
        handleEnrollComplete={model.handleEnrollComplete}
      />
    </div>
  );
}
