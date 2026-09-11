"use client";

import { useAuth } from "../../hooks/use-auth";
import { LogOut, User as UserIcon } from "lucide-react";

export const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/5 bg-bg-primary/70 px-6 backdrop-blur-xl transition-all">
      <div className="flex-1 flex items-center">
        <div className="h-8 w-1 rounded-full bg-accent mr-4"></div>
        <h1 className="text-lg font-semibold text-text-primary capitalize">
          {typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || 'Dashboard' : 'Dashboard'}
        </h1>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-semibold text-text-primary">{user?.fullName || "Người dùng"}</span>
          <span className="text-xs text-text-secondary font-medium">{user?.roles.includes('ROLE_ADMIN') ? 'Quản trị viên' : 'Nhân viên'}</span>
        </div>
        
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-bg-tertiary to-bg-secondary border border-white/10 text-text-primary shadow-inner overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent hover:ring-offset-2 hover:ring-offset-bg-primary transition-all">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5 text-text-secondary" />
          )}
        </div>
        
        <div className="h-6 w-px bg-border/50 hidden sm:block"></div>
        
        <button
          onClick={logout}
          className="rounded-full p-2 text-text-secondary hover:bg-danger/10 hover:text-danger transition-all duration-300 active:scale-95"
          title="Đăng xuất"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
