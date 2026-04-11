import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";
import { Clock, Store, ArrowUpRight } from "lucide-react";

interface StallSalesFeedProps {
  stallId: string;
}

export default function StallSalesFeed({ stallId }: StallSalesFeedProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stallId) return;

    // Listener realtime para ver vendas instantaneamente
    const q = query(
      collection(db, "transactions"),
      where("stall_id", "==", stallId),
      orderBy("created_at", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const txs: Transaction[] = [];
      snap.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar feed da barraca:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [stallId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-[hsl(var(--text-muted))]">Carregando feed...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
        <Store className="w-12 h-12 text-[hsl(var(--text-muted))] opacity-50 mb-4" />
        <p className="text-[hsl(var(--text-secondary))] mb-1">Câmeras limpas</p>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          Nenhuma transação foi registrada nesta barraca recentemente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2 mb-4">
        Ao Vivo: Vendas Recentes
      </h3>
      
      <div className="space-y-3">
        {transactions.map((tx) => {
          return (
            <div key={tx.id} className="glass-card p-4 flex items-center gap-4 hover:bg-[hsl(var(--card))]/60 transition-colors">
              {/* Ícone Venda */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500">
                <ArrowUpRight className="w-5 h-5" />
              </div>

              {/* Detalhes quem comprou e quem vendeu */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[hsl(var(--text-primary))] truncate">
                  {tx.user_name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))] mt-1">
                  <Clock className="w-3 h-3" />
                  {tx.created_at != null ? (typeof (tx.created_at as any)?.toDate === 'function' ? formatDate((tx.created_at as any).toDate()) : formatDate(new Date(tx.created_at as string))) : ''}
                  <span className="mx-1">•</span>
                  Vendedor: {tx.operator_name.split(" ")[0]}
                </div>
              </div>

              {/* Valor */}
              <div className="text-right">
                <p className="font-bold text-emerald-500 whitespace-nowrap">
                  +{formatCurrency(tx.amount_cents)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
