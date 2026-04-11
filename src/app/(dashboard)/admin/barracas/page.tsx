"use client";
import AuthGuard from "@/components/auth/AuthGuard";

export default function BarracasPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))] animate-slide-up">Barracas</h1>
        <div className="card animate-slide-up text-center py-12 text-[hsl(var(--text-muted))]">
          <p>CRUD de barracas será implementado na Fase 7</p>
        </div>
      </div>
    </AuthGuard>
  );
}
