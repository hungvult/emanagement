"use client";

import { useAuth } from "../../hooks/use-auth";
import { LogOut, User as UserIcon } from "lucide-react";

export const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background px-6 transition-all">
      <div className="flex-1 flex items-center">
        <div className="h-8 w-1 rounded-full bg-primary mr-4"></div>
        <h1 className="text-lg font-semibold text-foreground capitalize">
          {typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || 'Dashboard' : 'Dashboard'}
        </h1>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-semibold text-foreground">{user?.fullName || "Người dùng"}</span>
          <span className="text-xs text-muted-foreground font-medium">{user?.roles.includes('ROLE_ADMIN') ? 'Quản trị viên' : 'Nhân viên'}</span>
        </div>
        
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-foreground overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="h-6 w-px bg-border hidden sm:block"></div>
        
        <button
          onClick={logout}
          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 active:scale-95"
          title="Đăng xuất"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
