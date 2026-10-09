"use client";
import { getErrorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth.service";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const { error } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      error("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login({ identifier, password });

      if (response.status === "SUCCESS" && response.data) {
        await login(response.data.accessToken, response.data.refreshToken);
        router.push("/dashboard");
      } else {
        error(getErrorMessage(response, "Đăng nhập thất bại"));
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, "Lỗi kết nối đến máy chủ"));
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
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              eManagement
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Hệ thống Quản lý Nhân sự & Chấm công thông minh tích hợp công nghệ
              AI Computer Vision.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
              <ScanFace className="h-5 w-5 text-blue-400" />
              <div className="text-sm text-slate-300">
                Nhận diện khuôn mặt{" "}
                <span className="text-white font-semibold">&lt; 0.5s</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
              <Fingerprint className="h-5 w-5 text-indigo-400" />
              <div className="text-sm text-slate-300">
                Chống giả mạo Anti-Spoofing
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-7/12 p-8 sm:p-12 flex flex-col justify-center relative">
          <div className="max-w-[360px] w-full mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                Chào mừng trở lại
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Đăng nhập vào tài khoản của bạn
              </p>
            </div>

            {/* Form: Credentials */}
            <form
              onSubmit={handleLogin}
              className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Tài khoản
                </label>
                <Input
                  placeholder="Email hoặc mã nhân viên"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">
                    Mật khẩu
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
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
                    Đăng nhập{" "}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              {/* Redirect to Check-in */}
              <div className="pt-5 mt-6 border-t border-slate-100 flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-slate-500">
                  Bạn muốn điểm danh vào/ra ca?
                </p>
                <Link
                  href="/"
                  className="w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold bg-blue-50/80 hover:bg-blue-100 text-blue-600 rounded-xl transition-all border border-blue-100/50"
                >
                  <ScanFace className="h-4 w-4" /> Đi tới màn hình chấm công
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
