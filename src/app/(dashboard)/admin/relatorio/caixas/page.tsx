"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import { ArrowLeft, Loader2, Users } from "lucide-react";

export default function CaixasPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <CaixasContent />
    </AuthGuard>
  );
}

function CaixasContent() {
  const { user, userDoc } = useAuth();
  const [caixas, setCaixas] = useState<{ name: string; total: number; lastAt: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (userDoc?.role !== "admin" && userDoc?.role !== "desenvolvedor")) return;

    (async () => {
      try {
        const qRecharges = query(collection(db, "transactions"), where("type", "==", "recharge"));
        const snap = await getDocs(qRecharges);
        const map: Record<string, { total: number; lastAt: number; count: number }> = {};
        snap.forEach(d => {
          const data = d.data();
          const op = data.operator_name || "Desconhecido";
          const ts = data.created_at?.toMillis ? data.created_at.toMillis() : 0;
          if (!map[op]) map[op] = { total: 0, lastAt: 0, count: 0 };
          map[op].total += data.amount_cents || 0;
          map[op].count += 1;
          if (ts > map[op].lastAt) map[op].lastAt = ts;
        });
        setCaixas(
          Object.entries(map)
            .map(([name, agg]) => ({ name, ...agg }))
            .sort((a, b) => b.lastAt - a.lastAt)
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user, userDoc]);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/admin/relatorio" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Fechamento por Caixa</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))]">Ordenado pela atividade mais recente</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-center">Recargas</th>
                <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-right">Arrecadado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]/30">
              {caixas.map((c, i) => (
                <tr key={i} className="hover:bg-[hsl(var(--bg))]/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[hsl(var(--text-primary))] text-sm">{c.name}</p>
                    {c.lastAt > 0 && (
                      <p className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">
                        Última: {new Date(c.lastAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-medium text-[hsl(var(--text-secondary))]">
                    {c.count}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
