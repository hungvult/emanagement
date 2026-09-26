"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, LogIn, LayoutDashboard, ArrowRight, Briefcase } from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { LiveAttendanceModal } from "../components/attendance/live-attendance-modal";

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-foreground flex flex-col">
      {/* Background glows */}
      <div className="fixed top-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full bg-primary/[0.05] blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-5%] w-[350px] h-[350px] rounded-full bg-violet-400/[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full backdrop-blur-sm border-b border-border/50 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="text-base font-bold text-foreground tracking-tight">eManagement</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-primary font-mono">{currentTime}</span>
              <span className="text-[11px] text-muted-foreground capitalize">{currentDate}</span>
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm border border-border flex items-center gap-1.5 transition-all"
              >
                <LogIn className="h-4 w-4 text-primary" />
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
            Chấm công bằng
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-primary"> khuôn mặt</span>
          </h1>

        </div>

        {/* Two action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
          {/* Card 1: Face Attendance */}
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="group cursor-pointer rounded-2xl bg-card border border-border hover:border-primary/50 p-6 shadow-sm hover:shadow-lg hover:shadow-primary/[0.06] transition-all hover:-translate-y-0.5"
          >
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white shadow-md shadow-primary/20 mb-4 group-hover:scale-105 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
              Chấm công
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Quét khuôn mặt để vào ca / ra ca
            </p>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              Bắt đầu <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Login / Dashboard */}
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group rounded-2xl bg-card border border-border hover:border-primary/50 p-6 shadow-sm hover:shadow-lg hover:shadow-primary/[0.06] transition-all hover:-translate-y-0.5"
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 mb-4 group-hover:scale-105 transition-transform">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                Bảng điều khiển
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Xem bảng công, nghỉ phép, nhân sự
              </p>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                Mở <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="group rounded-2xl bg-card border border-border hover:border-primary/50 p-6 shadow-sm hover:shadow-lg hover:shadow-primary/[0.06] transition-all hover:-translate-y-0.5"
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 mb-4 group-hover:scale-105 transition-transform">
                <LogIn className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                Đăng nhập
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Dành cho nhân viên và quản lý
              </p>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                Đăng nhập <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}
        </div>

        {/* Mini steps */}
        <div className="flex items-center gap-6 mt-10 text-[11px] text-muted-foreground">
          {["Bấm chấm công", "Đưa mặt vào khung", "Hoàn tất!"].map((text, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                {i + 1}
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © 2026 eManagement
      </footer>

      {/* Modal */}
      <LiveAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
    </div>
  );
}
