"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/use-auth";
import { authService } from "../../services/auth.service";
import { useToast } from "../../components/ui/toast";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApiResponse } from "../../types/common.types";
import { JwtResponse } from "../../types/auth.types";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
        await login(response.data.accessToken);
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
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-accent/20 blur-[120px] mix-blend-screen" />
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[120px] mix-blend-screen" />
      </div>

      {/* Back button */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-white transition-all duration-300 z-20 glass px-5 py-2.5 rounded-full hover:bg-white/10 hover:shadow-lg"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Quay về trang chủ
      </Link>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <Card className="border-white/10 bg-bg-secondary/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-2">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="flex justify-center mb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-purple-600 text-white font-bold text-3xl shadow-lg shadow-accent/30 ring-4 ring-bg-primary">
                e
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-text-secondary">
              Đăng nhập
            </CardTitle>
            <p className="text-sm text-text-secondary/80">Quản lý nhân sự & chấm công thông minh</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Input
                  label="Tài khoản / Email / SĐT"
                  placeholder="admin@emanagement.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-secondary mb-1">Mật khẩu</label>
                  <Link href="/forgot-password" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors mb-1">
                    Quên mật khẩu?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-8 py-6 text-base font-semibold shadow-xl shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5 transition-all"
                isLoading={isLoading}
              >
                Đăng nhập hệ thống
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
