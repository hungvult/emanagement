"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../../services/auth.service";
import { useToast } from "../../components/ui/toast";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { success, error } = useToast();
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      error("Vui lòng nhập email, số điện thoại hoặc mã nhân viên");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.sendOtp({
        identifier: identifier.trim(),
        type: "RESET_PASSWORD"
      });
      
      if (response.status === "SUCCESS") {
        success("Mã OTP 6 số đã được gửi thành công. Vui lòng kiểm tra email/tin nhắn.");
        setStep(2);
      } else {
        error(response.message || "Không thể gửi mã OTP");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi kết nối đến máy chủ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      error("Mã OTP phải gồm đúng 6 chữ số");
      return;
    }

    if (newPassword.length < 8) {
      error("Mật khẩu mới phải có tối thiểu 8 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      error("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.resetPassword({
        identifier: identifier.trim(),
        otpCode: otpCode.trim(),
        newPassword: newPassword
      });
      
      if (response.status === "SUCCESS") {
        success("Đặt lại mật khẩu thành công! Đang chuyển hướng về trang đăng nhập...");
        setTimeout(() => router.push("/login"), 1500);
      } else {
        error(response.message || "Không thể đặt lại mật khẩu");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi khi đổi mật khẩu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 bg-bg-secondary/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold tracking-tight text-text-primary">
              Quên mật khẩu
            </CardTitle>
          </div>
          <p className="text-sm text-text-secondary">
            {step === 1 && "Nhập Email, SĐT hoặc Mã NV để nhận mã xác thực OTP"}
            {step === 2 && `Nhập mã OTP đã gửi tới ${identifier} và thiết lập mật khẩu mới`}
          </p>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Input
                label="Tài khoản (Email / SĐT / Mã NV) *"
                placeholder="VD: admin@emanagement.com hoặc EMP260001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
                required
              />
              <Button type="submit" className="w-full mt-6" isLoading={isLoading}>
                Gửi mã OTP xác thực
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-md bg-accent/10 p-3 border border-accent/20 mb-2">
                <p className="text-xs text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Mã OTP 6 số đã được gửi đến <strong>{identifier}</strong>
                </p>
              </div>

              <Input
                label="Mã OTP 6 chữ số *"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLoading}
                maxLength={6}
                required
              />

              <Input
                type="password"
                label="Mật khẩu mới *"
                placeholder="Ít nhất 8 ký tự (hoa, thường, số, ký tự đặc biệt)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              <Input
                type="password"
                label="Xác nhận mật khẩu *"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="flex-1" 
                  onClick={() => { setStep(1); setOtpCode(""); }} 
                  disabled={isLoading}
                >
                  Gửi lại OTP
                </Button>
                <Button type="submit" className="flex-1" isLoading={isLoading}>
                  Lưu mật khẩu mới
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

