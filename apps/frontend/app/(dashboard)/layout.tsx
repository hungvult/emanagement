import { AuthGuard } from "../../components/shared/auth-guard";
import { Sidebar } from "../../components/layout/sidebar";
import { Header } from "../../components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <div className="pl-64 transition-all duration-300">
          <Header />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
