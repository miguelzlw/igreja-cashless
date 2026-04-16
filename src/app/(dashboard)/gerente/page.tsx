"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import type { StallDoc } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { Activity, Store, AlertTriangle, Package, Users } from "lucide-react";

export default function GerentePage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <GerenteDashboard />
    </AuthGuard>
  );
}

function GerenteDashboard() {
  const { user, userDoc } = useAuth();
  const [stallData, setStallData] = useState<StallDoc | null>(null);
  const [stallError, setStallError] = useState("");
  const [stats, setStats] = useState({ products: 0, team: 0 });

  const stallId = userDoc?.stall_id;

  useEffect(() => {
    if (!stallId) return;

    const stallRef = doc(db, "stalls", stallId);
    const unsubStall = onSnapshot(stallRef, (snap) => {
      if (snap.exists()) setStallData(snap.data() as StallDoc);
      else setStallError("Barraca não encontrada.");
    }, (err) => { console.error(err); setStallError("Erro de permissão."); });

    // Fetch counts
    const fetchCounts = async () => {
      const qProducts = query(collection(db, "stalls", stallId, "products"), where("active", "==", true));
      const qTeam = query(collection(db, "users"), where("stall_id", "==", stallId));
      
      const [productsSnap, teamSnap] = await Promise.all([getDocs(qProducts), getDocs(qTeam)]);
      setStats({ products: productsSnap.size, team: teamSnap.size });
    };
    fetchCounts();

    return () => unsubStall();
  }, [stallId]);

  if (!user || !userDoc) return null;

  if (!stallId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-warning/10 text-warning flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">Sem Barraca Atribuída</h2>
        <p className="text-[hsl(var(--text-secondary))]">Peça ao Admin para te vincular a uma barraca.</p>
      </div>
    );
  }

  if (stallError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center text-danger">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{stallError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
            {stallData?.name || "Carregando..."}
          </h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Painel do Gerente</p>
        </div>
      </header>

      <section className="space-y-4">
        <div className="glass-card overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-24 h-24" />
          </div>
          <div className="relative z-10 p-6">
            <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Apurado Agora</p>
            <h2 className="text-5xl font-black tracking-tight text-emerald-500">
              {formatCurrency(stallData?.total_sales_cents || 0)}
            </h2>
            <p className="text-xs text-[hsl(var(--text-muted))] mt-2">
              {stats.products} produto(s) • {stats.team} membro(s)
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/gerente/cardapio" className="block">
          <div className="card-interactive p-6 text-center h-full flex flex-col items-center justify-center">
            <Package className="w-8 h-8 mb-2 text-primary" />
            <h2 className="font-bold text-[hsl(var(--text-primary))]">Cardápio</h2>
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">Gerenciar produtos</p>
          </div>
        </Link>

        <Link href="/gerente/membros" className="block">
          <div className="card-interactive p-6 text-center h-full flex flex-col items-center justify-center">
            <Users className="w-8 h-8 mb-2 text-primary" />
            <h2 className="font-bold text-[hsl(var(--text-primary))]">Equipe</h2>
            <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">Gerenciar vendedores</p>
          </div>
        </Link>

        <Link href="/vendedor" className="block col-span-2">
          <div className="card-interactive p-6">
            <div className="flex items-center justify-center gap-3">
              <Store className="w-6 h-6 text-success" />
              <div>
                <h2 className="font-bold text-[hsl(var(--text-primary))] text-center">Abrir PDV (Modo Vendedor)</h2>
                <p className="text-xs text-[hsl(var(--text-secondary))] text-center mt-1">Acessar tela de vendas da barraca</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
