"use client";

import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";

export default function GerentePage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <GerenteContent />
    </AuthGuard>
  );
}

function GerenteContent() {
  const { userDoc } = useAuth();

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
          Gerente de Barraca
        </h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          {userDoc?.name || "Minha Barraca"}
        </p>
      </div>

      {/* Two big action cards */}
      <div className="grid gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <Link href="/gerente/cardapio" className="block">
          <div className="card-interactive p-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-300 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[hsl(var(--text-primary))]">
                  Gerenciar Cardápio
                </h2>
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  Produtos, preços e estoque
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/vendedor" className="block">
          <div className="card-interactive p-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success to-success-light flex items-center justify-center text-white shadow-lg shadow-success/20">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[hsl(var(--text-primary))]">
                  Modo Vendedor
                </h2>
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  Abrir PDV para vendas
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick stats placeholder */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <Link href="/gerente/membros" className="card-interactive text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="font-semibold text-[hsl(var(--text-primary))]">Membros</p>
          <p className="text-xs text-[hsl(var(--text-muted))]">Equipe da barraca</p>
        </Link>

        <Link href="/gerente/relatorio" className="card-interactive text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="font-semibold text-[hsl(var(--text-primary))]">Relatório</p>
          <p className="text-xs text-[hsl(var(--text-muted))]">Vendas e faturamento</p>
        </Link>
      </div>
    </div>
  );
}
