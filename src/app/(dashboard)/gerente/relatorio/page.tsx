"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
import type { StallDoc, ProductDoc } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { ArrowLeft, BarChart2, Package, Activity } from "lucide-react";
import Link from "next/link";

export default function RelatorioPage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <RelatorioContent />
    </AuthGuard>
  );
}

function RelatorioContent() {
  const { user, userDoc } = useAuth();
  
  const [stallData, setStallData] = useState<StallDoc | null>(null);
  const [products, setProducts] = useState<ProductDoc[]>([]);

  const stallId = userDoc?.stall_id;

  useEffect(() => {
    if (!stallId) return;

    // Escutar dados da barraca para o faturamento total
    const stallRef = doc(db, "stalls", stallId);
    const unsubStall = onSnapshot(stallRef, (snap) => {
      if (snap.exists()) setStallData(snap.data() as StallDoc);
    });

    // Escutar produtos para exibir inventário
    const qProducts = query(collection(db, "stalls", stallId, "products"), orderBy("name", "asc"));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDoc)));
    });

    return () => {
      unsubStall();
      unsubProducts();
    };
  }, [stallId]);

  if (!user || !userDoc || !stallId) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/gerente" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">
            Relatório de Vendas
          </h1>
        </div>
      </header>

      {/* Card Faturamento Total */}
      <div className="glass-card overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity className="w-24 h-24" />
        </div>
        <div className="relative z-10 p-6">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Apurado na Barraca</p>
          <h2 className="text-4xl font-black tracking-tight text-emerald-500">
            {formatCurrency(stallData?.total_sales_cents || 0)}
          </h2>
        </div>
      </div>

      {/* Relatório de Inventário */}
      <section className="space-y-4">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2 px-1">
          <Package className="w-4 h-4 text-primary" /> Inventário de Produtos
        </h3>

        {products.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <p className="text-sm">Nenhum produto cadastrado para exibir no relatório.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[hsl(var(--bg))]/50">
                  <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase">Produto</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-right">Preço</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-right">Estoque Restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/30">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[hsl(var(--bg))]/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {p.emoji && <span className="text-lg">{p.emoji}</span>}
                        <span className="font-medium text-[hsl(var(--text-primary))] text-sm">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-primary text-sm">
                      {formatCurrency(p.price_cents)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.stock === -1 ? (
                        <span className="text-xs font-semibold text-emerald-500">Ilimitado</span>
                      ) : (
                        <span className={`text-sm font-bold ${p.stock === 0 ? 'text-danger' : p.stock <= 5 ? 'text-warning' : 'text-[hsl(var(--text-primary))]'}`}>
                          {p.stock}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
