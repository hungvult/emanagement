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
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/20">
        <Sidebar />
        <div className="lg:pl-64 flex flex-col min-h-screen transition-all duration-300">
          <Header />
          <main className="flex-1 p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
