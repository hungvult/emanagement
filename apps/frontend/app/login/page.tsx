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
import { ArrowLeft, Briefcase } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Back button */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 z-20 bg-background/50 backdrop-blur-sm border border-border px-5 py-2.5 rounded-full hover:bg-muted hover:shadow-sm"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Quay về trang chủ
      </Link>

      <div className="w-full max-w-md relative z-10">
        <Card className="border-border bg-card shadow-lg p-2">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="flex justify-center mb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-3xl shadow-sm ring-4 ring-background bg-gradient-to-br from-indigo-500 to-primary">
                <Briefcase className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
              Đăng nhập
            </CardTitle>
            <p className="text-sm text-muted-foreground">Quản lý nhân sự & chấm công thông minh</p>
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
                  <label className="text-sm font-medium text-muted-foreground mb-1">Mật khẩu</label>
                  <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-1">
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
                className="w-full mt-8 py-6 text-base font-semibold shadow-sm hover:-translate-y-0.5 transition-all"
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
