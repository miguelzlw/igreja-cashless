"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, onSnapshot, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import { BarChart2, Store, ArrowLeft, Loader2, ChevronDown, ChevronUp, Wallet, Banknote, Users } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import type { StallDoc, ProductDoc } from "@/lib/types";

interface StallWithProducts extends StallDoc {
  id: string;
  products: ProductDoc[];
}

export default function AdminRelatorioPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <AdminRelatorioContent />
    </AuthGuard>
  );
}

function AdminRelatorioContent() {
  const { user, userDoc } = useAuth();
  const [stalls, setStalls] = useState<StallWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStall, setExpandedStall] = useState<string | null>(null);

  const [totalRecharges, setTotalRecharges] = useState(0);
  const [totalRetido, setTotalRetido] = useState(0);
  const [caixas, setCaixas] = useState<{name: string, total: number}[]>([]);

  useEffect(() => {
    if (!user || userDoc?.role !== "admin") return;

    const fetchMetrics = async () => {
      try {
        // 1. Total Recargas & Fechamento por Caixa
        const qRecharges = query(collection(db, "transactions"), where("type", "==", "recharge"));
        const rechargesSnap = await getDocs(qRecharges);
        
        let sumRecharges = 0;
        const caixasMap: Record<string, number> = {};
        
        rechargesSnap.forEach(d => {
          const data = d.data();
          const amount = data.amount_cents || 0;
          sumRecharges += amount;
          const op = data.operator_name || "Desconhecido";
          caixasMap[op] = (caixasMap[op] || 0) + amount;
        });
        
        setTotalRecharges(sumRecharges);
        setCaixas(Object.entries(caixasMap).map(([name, total]) => ({name, total})).sort((a, b) => b.total - a.total));

        // 2. Saldo Retido
        const usersSnap = await getDocs(collection(db, "users"));
        let sumRetido = 0;
        usersSnap.forEach(d => {
          sumRetido += (d.data().balance || 0);
        });
        
        const tempSnap = await getDocs(collection(db, "temp_accounts"));
        tempSnap.forEach(d => {
          sumRetido += (d.data().balance || 0);
        });
        
        setTotalRetido(sumRetido);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetrics();

    const qStalls = query(collection(db, "stalls"));
    const unsub = onSnapshot(qStalls, async (snap) => {
      const stallsData: StallWithProducts[] = [];

      for (const stallDoc of snap.docs) {
        const stallData = stallDoc.data() as StallDoc;
        
        // Buscar produtos da barraca
        const qProducts = query(
          collection(db, "stalls", stallDoc.id, "products"),
          orderBy("name", "asc") 
        );
        
        const productsSnap = await getDocs(qProducts);
        // Ordenar localmente (JS) pelos produtos que mais faturaram para não depender de índices complexos agora
        const products = productsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ProductDoc))
          .sort((a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0));

        stallsData.push({
          id: stallDoc.id,
          ...stallData,
          products,
        });
      }
      
      // Ordenar barracas por faturamento total
      stallsData.sort((a, b) => b.total_sales_cents - a.total_sales_cents);
      
      setStalls(stallsData);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [user, userDoc]);

  if (!user || userDoc?.role !== "admin") return null;

  const eventTotalCents = stalls.reduce((sum, s) => sum + s.total_sales_cents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Relatório Geral</h1>
        </div>
      </header>

      <div className="glass-card p-6 text-center">
        <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Total Vendas (Consumido)</p>
        <h2 className="text-5xl font-black tracking-tight text-emerald-500">{formatCurrency(eventTotalCents)}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-1 flex justify-center items-center gap-1">
            <Banknote className="w-3 h-3" /> Total Recargas
          </p>
          <p className="text-xl font-black text-primary">{formatCurrency(totalRecharges)}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-1 flex justify-center items-center gap-1">
            <Wallet className="w-3 h-3" /> Saldo Retido
          </p>
          <p className="text-xl font-black text-warning">{formatCurrency(totalRetido)}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Fechamento por Caixa
        </h3>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : caixas.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <p>Nenhuma recarga registrada.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[hsl(var(--bg))]/50">
                  <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase">Operador</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-right">Arrecadado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/30">
                {caixas.map((c, i) => (
                  <tr key={i} className="hover:bg-[hsl(var(--bg))]/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-[hsl(var(--text-primary))] text-sm">{c.name}</td>
                    <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
          <Store className="w-4 h-4 text-primary" /> Desempenho das Barracas
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stalls.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <p>Nenhuma barraca registrada.</p>
          </div>
        ) : (
          stalls.map(stall => (
            <div key={stall.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedStall(expandedStall === stall.id ? null : stall.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--card))]/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${stall.is_active ? "bg-emerald-500" : "bg-danger"}`} />
                  <div className="text-left">
                    <p className="font-bold text-[hsl(var(--text-primary))]">{stall.name}</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">
                      {stall.products.length} produtos cadastrados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-emerald-500">{formatCurrency(stall.total_sales_cents)}</p>
                  {expandedStall === stall.id
                    ? <ChevronUp className="w-5 h-5 text-[hsl(var(--text-muted))]" />
                    : <ChevronDown className="w-5 h-5 text-[hsl(var(--text-muted))]" />
                  }
                </div>
              </button>

              {expandedStall === stall.id && (
                <div className="px-4 pb-4 border-t border-[hsl(var(--border))]/50">
                  <table className="w-full text-left mt-2">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))]/30">
                        <th className="py-2 text-xs font-semibold text-[hsl(var(--text-secondary))]">Produto</th>
                        <th className="py-2 text-xs font-semibold text-[hsl(var(--text-secondary))] text-center">Unid. Vendidas</th>
                        <th className="py-2 text-xs font-semibold text-[hsl(var(--text-secondary))] text-right">Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]/20">
                      {stall.products.map(p => (
                        <tr key={p.id} className="hover:bg-[hsl(var(--bg))]/30 transition-colors">
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2">
                              {p.emoji && <span>{p.emoji}</span>}
                              <span className="font-medium text-sm text-[hsl(var(--text-primary))]">{p.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center text-sm font-medium text-[hsl(var(--text-secondary))]">
                            {p.units_sold || 0}
                          </td>
                          <td className="py-3 text-right text-sm font-bold text-primary">
                            {formatCurrency(p.revenue_cents || 0)}
                          </td>
                        </tr>
                      ))}
                      {stall.products.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-sm text-[hsl(var(--text-muted))]">
                            Nenhum produto cadastrado nesta barraca.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
