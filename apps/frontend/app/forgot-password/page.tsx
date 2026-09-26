"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../../services/auth.service";
import { useToast } from "../../components/ui/toast";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
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
        success("Mã OTP đã được gửi thành công");
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
        success("Đặt lại mật khẩu thành công!");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4">
      {/* Subtle background glow */}
      <div className="fixed top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-violet-400/[0.05] blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl shadow-black/[0.03]">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Quên mật khẩu</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 1 ? "Nhập tài khoản để nhận mã OTP" : "Nhập OTP và mật khẩu mới"}
            </p>
          </div>

          {/* Form */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Input
                label="Email / SĐT / Mã NV"
                placeholder="admin@emanagement.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
                required
              />
              <Button type="submit" className="w-full py-6 text-base font-semibold shadow-md shadow-primary/15 hover:-translate-y-0.5 transition-all" isLoading={isLoading}>
                Gửi mã OTP
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 border border-emerald-200 dark:border-emerald-500/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  OTP đã gửi đến <strong>{identifier}</strong>
                </p>
              </div>

              <Input
                label="Mã OTP"
                placeholder="6 chữ số"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLoading}
                maxLength={6}
                required
              />

              <Input
                type="password"
                label="Mật khẩu mới"
                placeholder="Ít nhất 8 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              <Input
                type="password"
                label="Xác nhận mật khẩu"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              <div className="flex gap-3 pt-1">
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
                  Đổi mật khẩu
                </Button>
              </div>
            </form>
          )}

          {/* Footer link */}
          <p className="text-center text-xs text-muted-foreground mt-5 pt-5 border-t border-border">
            <Link href="/login" className="hover:text-foreground transition-colors">
              ← Quay về đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
