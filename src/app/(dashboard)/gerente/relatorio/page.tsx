"use client";
import AuthGuard from "@/components/auth/AuthGuard";

export default function RelatorioPage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))] animate-slide-up">Relatório da Barraca</h1>
        <div className="card animate-slide-up text-center py-12 text-[hsl(var(--text-muted))]">
          <p>Relatórios de vendas serão implementados na Fase 6</p>
        </div>
      </div>
    </AuthGuard>
  );
}
