"use client";
import NextImage from "next/image";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth.service";
import {
  KeyRound,
  Lock,
  Mail,
  Phone,
  Settings,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import React, { useState } from "react";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Form, 2: OTP
  const [activeTab, setActiveTab] = useState<"INFO" | "PASSWORD">("INFO");

  type ProfileForm = { fullName: string; phone: string; email: string };
  const [formDraft, setFormDraft] = useState<{
    source: typeof user;
    data: ProfileForm;
  } | null>(null);
  const formData: ProfileForm =
    formDraft?.source === user && formDraft
      ? formDraft.data
      : {
          fullName: user?.fullName || "",
          phone: user?.phone || "",
          email: user?.email || "",
        };
  const setFormData = (data: ProfileForm) =>
    setFormDraft({ source: user, data });

  const [otpCode, setOtpCode] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.fullName.trim()) {
      error("Họ và tên không được để trống");
      return;
    }

    const targetIdentifier = formData.email.trim() || formData.phone.trim();
    if (!targetIdentifier) {
      error("Vui lòng nhập Email hoặc Số điện thoại để nhận mã OTP xác thực");
      return;
    }

    setIsLoading(true);
    try {
      // Backend yêu cầu gửi OTP đến targetIdentifier (email hoặc phone mới)
      const res = await authService.sendOtp({
        identifier: targetIdentifier,
        type: "UPDATE_PROFILE",
      });

      if (res.status === "SUCCESS") {
        success(
          `Đã gửi mã OTP 6 số đến ${targetIdentifier}. Vui lòng kiểm tra hộp thư/tin nhắn.`,
        );
        setStep(2);
      } else {
        error(getErrorMessage(res, "Không thể gửi mã OTP"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi gửi yêu cầu OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      error("Mã OTP phải gồm đúng 6 chữ số");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.updateProfile({
        fullName: formData.fullName,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        otpCode: otpCode.trim(),
      });

      if (res.status === "SUCCESS") {
        success("Cập nhật thông tin hồ sơ thành công!");
        setIsEditing(false);
        setStep(1);
        setOtpCode("");
        await refreshUser();
      } else {
        error(getErrorMessage(res, "Không thể cập nhật thông tin"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Mã OTP không hợp lệ hoặc đã hết hạn"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-50/80 via-white to-white p-6 rounded-[32px] border border-indigo-100/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-indigo-600" />
            Hồ sơ cá nhân
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5 ml-11">
            Quản lý thông tin tài khoản và cập nhật bảo mật an toàn.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-50/50 p-1.5 rounded-[20px] w-fit border border-slate-100">
        <button
          onClick={() => setActiveTab("INFO")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-[14px] font-bold text-sm transition-all ${
            activeTab === "INFO"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          <User className="h-4 w-4" /> Thông tin tài khoản
        </button>
        <button
          onClick={() => setActiveTab("PASSWORD")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-[14px] font-bold text-sm transition-all ${
            activeTab === "PASSWORD"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          <Lock className="h-4 w-4" /> Đổi mật khẩu
        </button>
      </div>

      {activeTab === "INFO" && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1 space-y-6">
            <Card className="relative overflow-hidden group border-slate-100 bg-white shadow-sm rounded-[24px]">
              <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-r from-indigo-50 to-white" />
              <CardContent className="pt-14 pb-6 px-6 flex flex-col items-center text-center relative z-10">
                <div className="relative mb-5 group-hover:scale-105 transition-transform duration-300">
                  <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-indigo-50 ring-2 ring-indigo-100 shadow-lg">
                    {user?.avatarUrl ? (
                      <NextImage
                        unoptimized
                        width={640}
                        height={480}
                        src={user.avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-indigo-300 font-extrabold text-4xl">
                        {user.fullName?.charAt(0) || "U"}
                      </div>
                    )}
                  </div>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {user?.fullName}
                </h2>
                <p className="text-sm font-bold text-indigo-600 mt-1">
                  {user?.employeeCode}
                </p>

                <div className="mt-6 flex w-full flex-col gap-2">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm">
                    <span className="text-slate-500 font-semibold">
                      Chức vụ
                    </span>
                    <span className="font-extrabold text-slate-700">
                      {user?.roles?.includes("ROLE_ADMIN")
                        ? "Quản trị viên"
                        : "Nhân viên"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="border-slate-100 bg-white shadow-sm rounded-[24px]">
              <CardHeader className="border-b border-slate-100 pb-5 px-6 pt-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Settings className="h-5 w-5 text-indigo-500" />
                  Thiết lập tài khoản
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!isEditing ? (
                  <div className="space-y-4">
                    <div className="flex justify-end mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="rounded-xl font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        Chỉnh sửa thông tin
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-50 pb-4">
                      <div className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" /> Họ và tên
                      </div>
                      <div className="col-span-2 text-sm text-slate-800 font-bold">
                        {user.fullName}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-50 pb-4 pt-2">
                      <div className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-slate-400" /> Mã nhân
                        viên
                      </div>
                      <div className="col-span-2 text-sm text-slate-800 font-mono font-bold">
                        {user.employeeCode}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-50 pb-4 pt-2">
                      <div className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" /> Số điện
                        thoại
                      </div>
                      <div className="col-span-2 text-sm text-slate-800 font-mono font-bold">
                        {user.phone || "Chưa cập nhật"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-50 pb-4 pt-2">
                      <div className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" /> Email
                      </div>
                      <div className="col-span-2 text-sm text-slate-800 font-bold">
                        {user.email || "Chưa cập nhật"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 pt-2">
                      <div className="text-sm text-slate-500 font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-emerald-500" /> Bảo mật
                      </div>
                      <div className="col-span-2 text-[13px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit font-bold border border-emerald-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>{" "}
                        JWT & 2FA
                      </div>
                    </div>
                  </div>
                ) : step === 1 ? (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <Input
                      label="Họ và tên *"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      disabled={isLoading}
                      required
                      className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
                    />
                    <Input
                      label="Email mới"
                      type="email"
                      placeholder="VD: user@emanagement.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      disabled={isLoading}
                      className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
                    />
                    <Input
                      label="Số điện thoại mới"
                      placeholder="VD: 0912345678"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      disabled={isLoading}
                      className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
                    />
                    <p className="text-xs font-semibold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      Khi nhấn lưu, hệ thống sẽ gửi mã OTP 6 số đến Email/SĐT
                      mới để xác thực chính chủ.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsEditing(false)}
                        className="rounded-xl font-bold"
                      >
                        Hủy
                      </Button>
                      <Button
                        type="submit"
                        isLoading={isLoading}
                        className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Gửi mã OTP xác nhận
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-5">
                    <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 mb-4">
                      <p className="text-sm font-medium text-indigo-900">
                        Mã OTP 6 số đã được gửi đến{" "}
                        <strong className="font-extrabold">
                          {formData.email || formData.phone}
                        </strong>
                        . Vui lòng nhập mã để hoàn tất cập nhật.
                      </p>
                    </div>
                    <Input
                      label="Mã OTP 6 chữ số *"
                      value={otpCode}
                      onChange={(e) =>
                        setOtpCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder="123456"
                      maxLength={6}
                      disabled={isLoading}
                      required
                      className="bg-slate-50 border-transparent focus:bg-white rounded-xl text-center text-xl tracking-[0.5em] font-mono"
                    />
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(1)}
                        className="rounded-xl font-bold"
                      >
                        Quay lại
                      </Button>
                      <Button
                        type="submit"
                        isLoading={isLoading}
                        className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Xác nhận cập nhật
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "PASSWORD" && (
        <Card className="border-slate-100 bg-white shadow-sm rounded-[24px]">
          <CardHeader className="border-b border-slate-100 pb-5 px-6 pt-6">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Shield className="h-5 w-5 text-rose-500" />
              Đổi mật khẩu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const target = e.target as typeof e.target & {
                  oldPassword: { value: string };
                  newPassword: { value: string };
                  confirmPassword: { value: string };
                };
                if (target.newPassword.value !== target.confirmPassword.value) {
                  error("Mật khẩu mới không khớp");
                  return;
                }
                if (target.newPassword.value.length < 8) {
                  error("Mật khẩu mới phải từ 8 ký tự trở lên");
                  return;
                }
                setIsLoading(true);
                try {
                  const res = await authService.changePassword({
                    oldPassword: target.oldPassword.value,
                    newPassword: target.newPassword.value,
                  });
                  if (res.status === "SUCCESS") {
                    success("Đổi mật khẩu thành công!");
                    (e.target as HTMLFormElement).reset();
                  } else {
                    error(getErrorMessage(res, "Không thể đổi mật khẩu"));
                  }
                } catch (err: unknown) {
                  error(getErrorMessage(err, "Lỗi khi đổi mật khẩu"));
                } finally {
                  setIsLoading(false);
                }
              }}
              className="space-y-5 max-w-md"
            >
              <Input
                name="oldPassword"
                label="Mật khẩu hiện tại *"
                type="password"
                placeholder="Nhập mật khẩu cũ"
                disabled={isLoading}
                required
                className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
              />
              <Input
                name="newPassword"
                label="Mật khẩu mới *"
                type="password"
                placeholder="Nhập mật khẩu mới"
                disabled={isLoading}
                required
                className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
              />
              <Input
                name="confirmPassword"
                label="Xác nhận mật khẩu mới *"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                disabled={isLoading}
                required
                className="bg-slate-50 border-transparent focus:bg-white rounded-xl"
              />
              <div className="pt-2">
                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full sm:w-auto rounded-xl font-bold bg-slate-800 hover:bg-slate-900 text-white"
                >
                  Đổi mật khẩu
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
