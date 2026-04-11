"use client";
import AuthGuard from "@/components/auth/AuthGuard";

export default function MembrosPage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))] animate-slide-up">Membros da Barraca</h1>
        <div className="card animate-slide-up text-center py-12 text-[hsl(var(--text-muted))]">
          <p>Gerenciamento de vendedores será implementado na Fase 6</p>
        </div>
      </div>
    </AuthGuard>
  );
}
