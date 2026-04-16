"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import { Building2, Activity, Store, Users } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <AdminDashboard />
    </AuthGuard>
  );
}

function AdminDashboard() {
  const { user, userDoc } = useAuth();
  const [stalls, setStalls] = useState<{id: string, total_sales_cents: number}[]>([]);

  useEffect(() => {
    if (!user || userDoc?.role !== "admin") return;
    const q = query(collection(db, "stalls"));
    const unsub = onSnapshot(q, (snap) => {
      setStalls(snap.docs.map(d => ({
        id: d.id,
        total_sales_cents: d.data().total_sales_cents || 0,
      })));
    });
    return () => unsub();
  }, [user, userDoc]);

  if (!user || userDoc?.role !== "admin") return null;

  const eventTotalCents = stalls.reduce((sum, s) => sum + s.total_sales_cents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Administração Geral</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Controle completo do evento</p>
        </div>
      </header>

      {/* Resumo Global */}
      <div className="glass-card overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity className="w-32 h-32" />
        </div>
        <div className="relative z-10 p-6">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Faturamento Global</p>
          <h2 className="text-5xl font-black tracking-tight text-emerald-500">{formatCurrency(eventTotalCents)}</h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-3">
            {stalls.length} barraca{stalls.length !== 1 && "s"} ativas
          </p>
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/barracas" className="block">
          <div className="card-interactive p-6 text-center h-full flex flex-col items-center justify-center">
            <Store className="w-8 h-8 mb-2 text-primary" />
            <h2 className="font-bold text-[hsl(var(--text-primary))]">Barracas</h2>
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">Gerenciar barracas</p>
          </div>
        </Link>

        <Link href="/admin/usuarios" className="block">
          <div className="card-interactive p-6 text-center h-full flex flex-col items-center justify-center">
            <Users className="w-8 h-8 mb-2 text-primary" />
            <h2 className="font-bold text-[hsl(var(--text-primary))]">Usuários</h2>
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">Gerenciar acessos</p>
          </div>
        </Link>

        <Link href="/admin/relatorio" className="block col-span-2">
          <div className="card-interactive p-6">
            <div className="flex items-center justify-center gap-3">
              <Activity className="w-6 h-6 text-primary" />
              <div>
                <h2 className="font-bold text-[hsl(var(--text-primary))] text-center">Relatório Geral</h2>
                <p className="text-xs text-[hsl(var(--text-secondary))] text-center mt-1">Faturamento detalhado do evento</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
