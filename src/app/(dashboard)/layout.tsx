"use client";

import Navbar from "@/components/shared/Navbar";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col bg-[hsl(var(--bg))]">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6 animate-fade-in">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
