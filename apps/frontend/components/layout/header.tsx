"use client";

import { useAuth } from "../../hooks/use-auth";
import { LogOut, User as UserIcon, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "../ui/sheet";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Tổng quan",
  "/employees": "Nhân viên",
  "/attendance": "Chấm công",
  "/shifts": "Ca làm việc",
  "/my-schedule": "Lịch của tôi",
  "/leave-requests": "Nghỉ phép",
  "/alerts": "Cảnh báo",
  "/profile": "Hồ sơ",
};

export const Header = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Tìm tiêu đề phù hợp nhất dựa trên pathname hiện tại
  const currentTitle = 
    PAGE_TITLES[pathname] || 
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] || 
    "Tổng quan";

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-xl px-6 md:px-8 transition-all shadow-sm">
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger render={<button className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden transition-colors" />}>
            <Menu className="h-6 w-6" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Điều hướng hệ thống</SheetDescription>
            <Sidebar isMobile />
          </SheetContent>
        </Sheet>
        
        <div className="hidden lg:flex items-center gap-3">
          <div className="h-6 w-1.5 rounded-full bg-indigo-500"></div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            {currentTitle}
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-bold text-slate-800 tracking-tight">{user?.fullName || "Người dùng"}</span>
          <span className="text-xs text-slate-500 font-medium">{user?.roles.includes('ROLE_ADMIN') ? 'Quản trị viên' : 'Nhân viên'}</span>
        </div>
        
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 overflow-hidden shadow-sm hover:shadow-md hover:ring-2 hover:ring-indigo-500 hover:ring-offset-2 transition-all cursor-pointer">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
        </div>
        
        <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
        
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={logout}
            className="rounded-full p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
            title="Đăng xuất"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
