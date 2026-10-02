"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  UserCircle,
  Briefcase,
} from "lucide-react";

export const Sidebar = ({ isMobile }: { isMobile?: boolean }) => {
  const pathname = usePathname();
  const { hasRole } = useAuth();

  const menuItems = [
    {
      title: "Tổng quan",
      icon: LayoutDashboard,
      href: "/dashboard",
      show: true, // Cả ADMIN và USER đều thấy
    },
    {
      title: "Nhân viên",
      icon: Users,
      href: "/employees",
      show: hasRole("ROLE_ADMIN"),
    },
    {
      title: "Chấm công",
      icon: Clock,
      href: "/attendance",
      show: true,
    },
    {
      title: "Ca làm việc",
      icon: Calendar,
      href: "/shifts",
      show: hasRole("ROLE_ADMIN"),
    },
    {
      title: "Lịch của tôi",
      icon: Calendar,
      href: "/my-schedule",
      show: !hasRole("ROLE_ADMIN"),
    },
    {
      title: "Nghỉ phép",
      icon: FileText,
      href: "/leave-requests",
      show: true,
    },
    {
      title: "Cảnh báo",
      icon: AlertTriangle,
      href: "/alerts",
      show: hasRole("ROLE_ADMIN"),
    },
    {
      title: "Hồ sơ",
      icon: UserCircle,
      href: "/profile",
      show: true,
    },
  ];

  const content = (
    <>
      <div className="flex h-20 items-center border-b border-slate-100 px-6 shrink-0">
        <div className="flex items-center gap-3 font-extrabold text-xl text-slate-900 tracking-tight">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            <Briefcase className="h-5 w-5" />
          </div>
          <span>eManagement</span>
        </div>
      </div>
      
      <div className="flex flex-col py-6 px-4 space-y-1.5 overflow-y-auto h-full">
        <div className="text-[11px] font-bold text-slate-400 mb-3 px-3 uppercase tracking-widest">Menu</div>
        {menuItems.filter(item => item.show).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive ? "scale-105" : "group-hover:scale-110")} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-white">
        {content}
      </div>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-100 bg-white transition-all duration-300 hidden lg:flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {content}
    </aside>
  );
};
