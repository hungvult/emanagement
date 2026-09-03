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
} from "lucide-react";

export const Sidebar = () => {
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

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-white/5 bg-bg-secondary/40 backdrop-blur-2xl transition-all duration-300 shadow-2xl shadow-black/50">
      <div className="flex h-16 items-center border-b border-white/5 px-6">
        <div className="flex items-center gap-3 font-bold text-xl text-text-primary">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-purple-600 text-white shadow-lg shadow-accent/20">
            e
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">Management</span>
        </div>
      </div>
      
      <div className="flex flex-col py-6 px-4 space-y-1.5 overflow-y-auto h-[calc(100vh-4rem)]">
        <div className="text-xs font-semibold text-text-secondary/60 mb-2 px-2 uppercase tracking-wider">Menu</div>
        {menuItems.filter(item => item.show).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                isActive 
                  ? "bg-gradient-to-r from-accent/20 to-purple-500/10 text-accent-hover shadow-[inset_2px_0_0_0_#818cf8]" 
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </aside>
  );
};
