"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, LogIn, LayoutDashboard, ArrowRight, Briefcase, Zap, ShieldCheck, Clock, Fingerprint, Activity } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/20 overflow-hidden flex flex-col relative">
      {/* Dynamic Light Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse duration-1000"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-violet-400/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse duration-700 delay-300"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      </div>

      {/* Header */}
      <header className="w-full relative z-30 pt-6 px-6">
        <div className="max-w-6xl mx-auto rounded-2xl bg-white/70 border border-white backdrop-blur-xl px-6 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">eManagement</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-lg bg-white border border-slate-100 shadow-sm">
              <Clock className="h-4 w-4 text-indigo-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 font-mono leading-none">{currentTime}</span>
                <span className="text-[10px] text-slate-500 capitalize leading-none mt-1">{currentDate}</span>
              </div>
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
              >
                <LayoutDashboard className="h-4 w-4" />
                Vào Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-200 shadow-sm flex items-center gap-2 transition-all hover:scale-105"
              >
                <LogIn className="h-4 w-4 text-indigo-500" />
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 w-full max-w-6xl mx-auto mt-8 mb-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 w-full items-center">
          
          {/* Left Column: Hero Text */}
          <div className="flex flex-col items-start text-left max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-700">
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.15]">
              Kỷ nguyên mới của <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
                Nhận diện khuôn mặt
              </span>
            </h1>
            <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-xl font-medium">
              Trải nghiệm điểm danh tốc độ ánh sáng dưới 0.5s. Tích hợp công nghệ chống giả mạo tiên tiến nhất (Anti-Spoofing) và nhận dạng thụ động.
            </p>
            
          </div>

          {/* Right Column: Interaction Cards */}
          <div className="flex flex-col gap-6 w-full max-w-md mx-auto lg:mx-0 lg:ml-auto animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150">
            
            {/* Primary Action: Face Check-in */}
            <button
              onClick={() => setIsAttendanceModalOpen(true)}
              className="group relative w-full text-left p-[2px] rounded-[28px] overflow-hidden transition-transform hover:scale-[1.02] duration-300 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 opacity-80 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-xl p-8 rounded-[26px] border border-white flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-100 transition-colors shadow-sm">
                    <Camera className="h-7 w-7 text-indigo-600" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all shadow-sm">
                    <ArrowRight className="h-5 w-5 text-slate-400 transform -rotate-45 group-hover:rotate-0 group-hover:text-white transition-transform duration-300" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Chấm công FaceID</h3>
                  <p className="text-slate-500 text-sm leading-relaxed font-medium">
                    Khởi động camera AI để nhận diện điểm danh vào/ra ca lập tức không cần chạm.
                  </p>
                </div>
              </div>
            </button>

            {/* Secondary Action: Dashboard/Login */}
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="group relative w-full text-left p-6 rounded-[24px] bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all hover:scale-[1.02] duration-300 flex items-center gap-6 shadow-sm"
              >
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                  <LayoutDashboard className="h-7 w-7 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">Bảng điều khiển</h3>
                  <p className="text-slate-500 text-sm font-medium">Quản lý nhân sự & báo cáo</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto group-hover:text-indigo-600 transition-colors group-hover:translate-x-1" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="group relative w-full text-left p-6 rounded-[24px] bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all hover:scale-[1.02] duration-300 flex items-center gap-6 shadow-sm"
              >
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                  <LogIn className="h-7 w-7 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">Cổng đăng nhập</h3>
                  <p className="text-slate-500 text-sm font-medium">Dành cho Cán bộ & Quản lý</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 ml-auto group-hover:text-indigo-600 transition-colors group-hover:translate-x-1" />
              </Link>
            )}
          </div>
          
        </div>
      </main>

      {/* Decorative Gradient Wave at Bottom */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none opacity-[0.08] z-0">
        <svg viewBox="0 0 1440 320" className="w-full h-auto">
          <path fill="none" stroke="url(#gradient)" strokeWidth="2" d="M0,160 C320,300,420,0,740,160 C1060,320,1120,0,1440,160"></path>
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="50%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <LiveAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
    </div>
  );
}
