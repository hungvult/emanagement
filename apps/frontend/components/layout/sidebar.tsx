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
      <div className="flex h-16 items-center border-b border-border px-6 shrink-0">
        <div className="flex items-center gap-3 font-bold text-xl text-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm bg-gradient-to-br from-indigo-500 to-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="tracking-tight">eManagement</span>
        </div>
      </div>
      
      <div className="flex flex-col py-6 px-4 space-y-1.5 overflow-y-auto h-full">
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">Menu</div>
        {menuItems.filter(item => item.show).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive ? "scale-105" : "group-hover:scale-105")} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-card">
        {content}
      </div>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card text-card-foreground transition-all duration-300 hidden lg:flex flex-col">
      {content}
    </aside>
  );
};
