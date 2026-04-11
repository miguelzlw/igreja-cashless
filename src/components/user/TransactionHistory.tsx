import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight, Clock, Store } from "lucide-react";

interface TransactionHistoryProps {
  userId: string;
}

export default function TransactionHistory({ userId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchTransactions = async () => {
      try {
        const q = query(
          collection(db, "transactions"),
          where("user_id", "==", userId),
          orderBy("created_at", "desc"),
          limit(20)
        );

        const snap = await getDocs(q);
        const txs: Transaction[] = [];
        snap.forEach((doc) => {
          txs.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        
        setTransactions(txs);
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-[hsl(var(--text-muted))]">Carregando histórico...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
        <Clock className="w-12 h-12 text-[hsl(var(--text-muted))] opacity-50 mb-4" />
        <p className="text-[hsl(var(--text-secondary))] mb-1">Nenhuma transação ainda</p>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          Faça uma recarga no caixa para começar a aproveitar a festa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2 mb-4">
        Atividade Recente
      </h3>
      
      <div className="space-y-3">
        {transactions.map((tx) => {
          const isCredit = tx.type === "recharge" || tx.type === "refund";
          const isPix = tx.payment_method === "pix";
          
          return (
            <div key={tx.id} className="glass-card p-4 flex items-center gap-4 hover:bg-[hsl(var(--card))]/60 transition-colors">
              {/* Ícone */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isCredit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </div>

              {/* Detalhes */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[hsl(var(--text-primary))] truncate">
                  {tx.type === "purchase" ? tx.stall_name || "Compra na Barraca" : 
                   tx.type === "recharge" ? (isPix ? "Recarga via PIX" : "Recarga Manual") :
                   tx.type === "refund" ? "Estorno" : "Transação"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))] mt-1">
                  <Clock className="w-3 h-3" />
                  {tx.created_at != null ? (typeof (tx.created_at as any)?.toDate === 'function' ? formatDate((tx.created_at as any).toDate()) : formatDate(new Date(tx.created_at as string))) : ''}
                </div>
              </div>

              {/* Valor */}
              <div className="text-right">
                <p className={`font-bold whitespace-nowrap ${
                  isCredit ? 'text-emerald-500' : 'text-[hsl(var(--text-primary))]'
                }`}>
                  {isCredit ? "+" : "-"}{formatCurrency(tx.amount_cents)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
