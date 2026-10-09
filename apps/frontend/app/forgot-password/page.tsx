"use client";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/services/auth.service";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

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
        type: "RESET_PASSWORD",
      });

      if (response.status === "SUCCESS") {
        success("Mã OTP đã được gửi thành công");
        setStep(2);
      } else {
        error(getErrorMessage(response, "Không thể gửi mã OTP"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi kết nối đến máy chủ"));
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
        newPassword: newPassword,
      });

      if (response.status === "SUCCESS") {
        success("Đặt lại mật khẩu thành công!");
        setTimeout(() => router.push("/login"), 1500);
      } else {
        error(getErrorMessage(response, "Không thể đặt lại mật khẩu"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi khi đổi mật khẩu"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
      {/* High-tech Background Accents */}
      <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[900px] bg-white rounded-3xl shadow-2xl flex overflow-hidden relative z-10 border border-slate-100 min-h-[540px]">
        {/* Left Side - Brand & Info */}
        <div className="hidden md:flex flex-col justify-between w-5/12 bg-slate-900 p-10 relative overflow-hidden text-white">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/30 rounded-full blur-[80px]"></div>

          <div className="relative z-10">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              Khôi phục <br /> Tài khoản
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mt-4">
              Hệ thống eManagement đảm bảo quy trình đặt lại mật khẩu an toàn,
              nhanh chóng với mã xác thực đa kênh.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div className="text-sm text-slate-300">
                Bảo mật chuẩn{" "}
                <span className="text-white font-semibold">Enterprise</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-7/12 p-8 sm:p-12 flex flex-col justify-center relative">
          <Link
            href="/login"
            className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại
          </Link>

          <div className="max-w-[360px] w-full mx-auto mt-8 md:mt-0">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                {step === 1 ? "Quên mật khẩu?" : "Tạo mật khẩu mới"}
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                {step === 1
                  ? "Vui lòng nhập thông tin để nhận mã xác thực (OTP)."
                  : "Mã xác thực đã được gửi. Hãy tạo mật khẩu an toàn."}
              </p>
            </div>

            {/* Form Step 1: Send OTP */}
            {step === 1 && (
              <form
                onSubmit={handleSendOtp}
                className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Tài khoản
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Mail className="h-5 w-5" />
                    </div>
                    <Input
                      placeholder="Email, SĐT hoặc Mã NV"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-11 h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl mt-4 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 group"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Gửi mã OTP{" "}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Form Step 2: Reset Password */}
            {step === 2 && (
              <form
                onSubmit={handleResetPassword}
                className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="rounded-xl bg-blue-50 p-3 border border-blue-100 flex items-start gap-3 mb-6">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Mã OTP (6 số) đã được gửi đến <br />
                    <strong className="font-semibold text-blue-900">
                      {identifier}
                    </strong>
                    .
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Mã xác thực (OTP)
                  </label>
                  <Input
                    placeholder="Nhập 6 chữ số"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={isLoading}
                    maxLength={6}
                    required
                    className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all text-center tracking-widest text-lg font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Mật khẩu mới
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Input
                      type="password"
                      placeholder="Ít nhất 8 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-11 h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <Input
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-11 h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={() => {
                      setStep(1);
                      setOtpCode("");
                    }}
                    disabled={isLoading}
                  >
                    Gửi lại OTP
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md shadow-slate-900/10"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Xác nhận"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
