import "@/app/globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/hooks/use-auth";
import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { Geist, Inter } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "eManagement",
  description: "Employee attendance management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
