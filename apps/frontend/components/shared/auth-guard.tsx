"use client";

import { Button } from "@/components/ui/button";
import { FullScreenLoading } from "@/components/ui/loading";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, authError, refreshUser, logout } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !authError) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, authError, router, pathname]);

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (!isAuthenticated) {
    if (authError)
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p role="alert">{authError}</p>
          <Button
            onClick={() => {
              void refreshUser().catch(() => {});
            }}
          >
            Thử lại
          </Button>
          <Button variant="outline" onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      );
    return null;
  }

  return <>{children}</>;
};
