"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Camera,
  LogIn,
  LayoutDashboard,
  Clock,
  CheckCircle,
  Calendar,
  Sparkles,
  Shield,
  HelpCircle,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { LiveAttendanceModal } from "../components/attendance/live-attendance-modal";

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // Live Digital Clock for Employees
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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Friendly Header */}
      <header className="w-full bg-background/90 border-b border-border sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-xl shadow-md shadow-primary/20 bg-gradient-to-br from-indigo-500 to-primary">
              <Briefcase className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  eManagement
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Hệ thống Chấm công & Quản lý Nhân sự
              </p>
            </div>
          </div>

          {/* Live Clock & Right Status */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-sm font-bold text-primary font-mono tracking-wider">
                {currentTime}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{currentDate}</span>
            </div>

            {isAuthenticated ? (
              <Link href="/dashboard">
                <button className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Vào Bảng điều khiển</span>
                </button>
              </Link>
            ) : (
              <Link href="/login">
                <button className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium text-xs sm:text-sm border border-border flex items-center gap-1.5 transition-all">
                  <LogIn className="h-4 w-4 text-primary" />
                  <span>Đăng nhập</span>
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Friendly Welcome & Action Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8 flex flex-col justify-center">
        {/* Welcome Greeting */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold mb-2">
            <Sparkles className="h-3 w-3" />
            <span>CHÀO MỪNG BẠN ĐẾN VỚI HỆ THỐNG ĐIỂM DANH TỰ ĐỘNG</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Điểm danh nhanh chóng & Quản lý dễ dàng
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-lg mx-auto">
            Vui lòng chọn một trong hai chức năng bên dưới để bắt đầu:
          </p>
        </div>

        {/* 2 Big Friendly Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
          {/* Card 1: Face ID Attendance Check-in */}
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="group cursor-pointer p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary shadow-sm hover:shadow-[0_0_25px_rgba(79,70,229,0.1)] transition-all transform hover:-translate-y-0.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Camera className="h-5 w-5 animate-pulse" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Sẵn sàng quét
                </span>
              </div>

              <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                Quét Chấm Công Face ID
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Chỉ cần đứng trước camera 1 giây, hệ thống sẽ tự động nhận diện khuôn mặt và ghi nhận giờ vào ca / ra ca của bạn.
              </p>
            </div>

            <button className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all">
              <Camera className="h-4 w-4" />
              <span>Bắt đầu chấm công ngay</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 2: Login or Go to Dashboard */}
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold">
                    Đã đăng nhập
                  </span>
                </div>

                <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                  Bảng Điều Khiển Nhân Sự
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Xem lịch sử chấm công cá nhân, theo dõi ca làm việc, gửi đơn xin nghỉ phép và quản lý nhân viên.
                </p>
              </div>

              <button className="w-full py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-sm border border-border flex items-center justify-center gap-2 transition-all">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <span>Vào trang quản lý</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          ) : (
            <Link
              href="/login"
              className="group p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <LogIn className="h-5 w-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-semibold">
                    Nhân viên & Quản trị
                  </span>
                </div>

                <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                  Đăng Nhập Tài Khoản
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Dành cho nhân viên và quản lý đăng nhập để xem lịch làm việc, bảng công, duyệt đơn nghỉ phép và cấu hình hệ thống.
                </p>
              </div>

              <button className="w-full py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-sm border border-border flex items-center justify-center gap-2 transition-all">
                <LogIn className="h-4 w-4 text-primary" />
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          )}
        </div>

        {/* 3 Quick & Friendly Steps Guide */}
        <div className="mt-8 p-4 rounded-xl bg-muted border border-border max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span>Hướng dẫn 3 bước chấm công:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                1
              </span>
              <span>Bấm nút <strong>"Bắt đầu chấm công ngay"</strong> để bật máy ảnh.</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                2
              </span>
              <span>Đưa khuôn mặt vào giữa vòng tròn.</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                3
              </span>
              <span>Hệ thống tự nhận diện và đọc lời chào xác nhận.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Friendly Bottom Footer */}
      <footer className="w-full bg-background border-t border-border py-4 px-4 sm:px-6 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 eManagement • Hệ thống Chấm công & Quản lý Nhân sự</span>
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Hệ thống máy chủ hoạt động bình thường</span>
          </div>
        </div>
      </footer>

      {/* Live Attendance Check-in Modal */}
      <LiveAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
    </div>
  );
}
