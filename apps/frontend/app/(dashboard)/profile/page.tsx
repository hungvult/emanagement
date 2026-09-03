"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { authService } from "../../../services/auth.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import { UserCircle, Shield, Mail, Phone, User, KeyRound, Settings } from "lucide-react";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Form, 2: OTP
  
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: ""
  });
  
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
        email: user.email || ""
      });
    }
  }, [user]);

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
        type: "UPDATE_PROFILE"
      });
      
      if (res.status === "SUCCESS") {
        success(`Đã gửi mã OTP 6 số đến ${targetIdentifier}. Vui lòng kiểm tra hộp thư/tin nhắn.`);
        setStep(2);
      } else {
        error(res.message || "Không thể gửi mã OTP");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi gửi yêu cầu OTP");
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
        otpCode: otpCode.trim()
      });
      
      if (res.status === "SUCCESS") {
        success("Cập nhật thông tin hồ sơ thành công!");
        setIsEditing(false);
        setStep(1);
        setOtpCode("");
        await refreshUser();
      } else {
        error(res.message || "Không thể cập nhật thông tin");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Mã OTP không hợp lệ hoặc đã hết hạn");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Hồ sơ cá nhân</h1>
        <p className="text-text-secondary">Quản lý thông tin tài khoản và cập nhật bảo mật an toàn.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <Card className="relative overflow-hidden group border-white/5 bg-bg-secondary/40 backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-accent/20 to-purple-600/20" />
            <CardContent className="pt-12 pb-6 px-6 flex flex-col items-center text-center relative z-10">
              <div className="relative mb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-bg-primary bg-bg-tertiary ring-2 ring-accent/30 shadow-xl">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle className="h-full w-full p-4 text-text-secondary" />
                  )}
                </div>
              </div>
              <h2 className="text-xl font-bold text-text-primary bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">{user?.fullName}</h2>
              <p className="text-sm font-medium text-accent mt-1">{user?.employeeCode}</p>
              
              <div className="mt-6 flex w-full flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg bg-bg-tertiary/50 border border-white/5 px-3 py-2 text-sm shadow-inner">
                  <span className="text-text-secondary">Chức vụ</span>
                  <span className="font-medium text-text-primary">
                    {user?.roles?.includes("ROLE_ADMIN") ? "Quản trị viên" : "Nhân viên"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-white/5 bg-bg-secondary/40 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-accent" />
                Thiết lập tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="flex justify-end mb-4">
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                      Chỉnh sửa thông tin
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 border-b border-border pb-3">
                    <div className="text-sm text-text-secondary font-medium flex items-center gap-1.5">
                      <User className="h-4 w-4 text-text-secondary" /> Họ và tên
                    </div>
                    <div className="col-span-2 text-sm text-text-primary font-medium">{user.fullName}</div>
                  </div>
                  <div className="grid grid-cols-3 border-b border-border pb-3">
                    <div className="text-sm text-text-secondary font-medium flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-text-secondary" /> Mã nhân viên
                    </div>
                    <div className="col-span-2 text-sm text-text-primary font-mono">{user.employeeCode}</div>
                  </div>
                  <div className="grid grid-cols-3 border-b border-border pb-3">
                    <div className="text-sm text-text-secondary font-medium flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-text-secondary" /> Số điện thoại
                    </div>
                    <div className="col-span-2 text-sm text-text-primary font-mono">{user.phone || "Chưa cập nhật"}</div>
                  </div>
                  <div className="grid grid-cols-3 border-b border-border pb-3">
                    <div className="text-sm text-text-secondary font-medium flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-text-secondary" /> Email
                    </div>
                    <div className="col-span-2 text-sm text-text-primary">{user.email || "Chưa cập nhật"}</div>
                  </div>
                  <div className="grid grid-cols-3">
                    <div className="text-sm text-text-secondary font-medium flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-success" /> Bảo mật
                    </div>
                    <div className="col-span-2 text-sm text-text-primary flex items-center gap-1">
                      <span className="text-success font-medium">Bảo vệ bởi JWT & Xác thực OTP 2FA</span>
                    </div>
                  </div>
                </div>
              ) : step === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                <Input
                  label="Họ và tên *"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  disabled={isLoading}
                  required
                />
                <Input
                  label="Email mới"
                  type="email"
                  placeholder="VD: user@emanagement.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  label="Số điện thoại mới"
                  placeholder="VD: 0912345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={isLoading}
                />
                <p className="text-xs text-text-secondary">
                  Khi nhấn lưu, hệ thống sẽ gửi mã OTP 6 số đến Email/SĐT mới để xác thực chính chủ.
                </p>
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" isLoading={isLoading}>
                    Gửi mã OTP xác nhận
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="rounded-md bg-accent/10 p-4 border border-accent/20 mb-4">
                  <p className="text-sm text-text-primary">
                    Mã OTP 6 số đã được gửi đến <strong>{formData.email || formData.phone}</strong>. Vui lòng nhập mã để hoàn tất cập nhật.
                  </p>
                </div>
                <Input
                  label="Mã OTP 6 chữ số *"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  disabled={isLoading}
                  required
                />
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    Quay lại
                  </Button>
                  <Button type="submit" isLoading={isLoading}>
                    Xác nhận cập nhật
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>

  <div className="mt-6 space-y-6 max-w-4xl mx-auto">
    <Card className="border-white/5 bg-bg-secondary/40 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          Đổi mật khẩu
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={async (e) => {
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
              newPassword: target.newPassword.value
            });
            if (res.status === "SUCCESS") {
              success("Đổi mật khẩu thành công!");
              (e.target as HTMLFormElement).reset();
            } else {
              error(res.message || "Không thể đổi mật khẩu");
            }
          } catch (err: any) {
            error(err.response?.data?.message || err.message || "Lỗi khi đổi mật khẩu");
          } finally {
            setIsLoading(false);
          }
        }} className="space-y-4 max-w-md">
          <Input
            name="oldPassword"
            label="Mật khẩu hiện tại *"
            type="password"
            placeholder="Nhập mật khẩu cũ"
            disabled={isLoading}
            required
          />
          <Input
            name="newPassword"
            label="Mật khẩu mới *"
            type="password"
            placeholder="Nhập mật khẩu mới"
            disabled={isLoading}
            required
          />
          <Input
            name="confirmPassword"
            label="Xác nhận mật khẩu mới *"
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            disabled={isLoading}
            required
          />
          <div className="pt-2">
            <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto">
              Đổi mật khẩu
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
  </>
  );
}

