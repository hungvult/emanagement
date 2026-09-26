"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/use-auth";
import { authService } from "../../services/auth.service";
import { useToast } from "../../components/ui/toast";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { Briefcase, Eye, EyeOff } from "lucide-react";
import { ApiResponse } from "../../types/common.types";
import { JwtResponse } from "../../types/auth.types";

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
        error(response.message || "Đăng nhập thất bại");
      }
    } catch (err: any) {
      error(err.response?.data?.message || err.message || "Lỗi kết nối đến máy chủ");
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
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white shadow-lg shadow-primary/25 mb-4">
              <Briefcase className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Đăng nhập</h1>
            <p className="text-sm text-muted-foreground mt-1">eManagement System</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Tài khoản"
              placeholder="Email hoặc số điện thoại"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Mật khẩu</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
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
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-6 text-base font-semibold shadow-md shadow-primary/15 hover:-translate-y-0.5 transition-all"
              isLoading={isLoading}
            >
              Đăng nhập
            </Button>
          </form>

          {/* Footer link */}
          <p className="text-center text-xs text-muted-foreground mt-5 pt-5 border-t border-border">
            <Link href="/" className="hover:text-foreground transition-colors">
              ← Quay về trang chủ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
