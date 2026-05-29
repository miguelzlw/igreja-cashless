import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, orderBy, getDocs, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight, Clock, MoreHorizontal } from "lucide-react";

interface TransactionHistoryProps {
  userId: string;
  /** Limita quantos itens mostrar. Quando informado e existem mais, exibe link "ver tudo". */
  limit?: number;
}

export default function TransactionHistory({ userId, limit }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchTransactions = async () => {
      try {
        // Sempre lê N+1 quando limit for usado, pra saber se há "mais"
        const fetchSize = limit ? limit + 1 : 50;
        const q = query(
          collection(db, "transactions"),
          where("user_id", "==", userId),
          orderBy("created_at", "desc"),
          firestoreLimit(fetchSize)
        );

        const snap = await getDocs(q);
        const txs: Transaction[] = [];
        snap.forEach((doc) => {
          txs.push({ id: doc.id, ...doc.data() } as Transaction);
        });

        if (limit && txs.length > limit) {
          setHasMore(true);
          setTransactions(txs.slice(0, limit));
        } else {
          setHasMore(false);
          setTransactions(txs);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [userId, limit]);

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
      <div className="bg-[hsl(var(--surface))] rounded-3xl shadow-terra p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-primary/60" />
        </div>
        <p className="font-headline font-bold text-[hsl(var(--text-primary))] mb-1">Nenhuma transação ainda</p>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          Faça uma recarga no caixa para começar a aproveitar a festa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-headline text-2xl font-bold text-[hsl(var(--text-primary))]">
        Histórico Recente
      </h3>

      <div className="space-y-2.5">
        {transactions.map((tx) => {
          const isCredit = tx.type === "recharge" || tx.type === "refund";
          const isPix = tx.payment_method === "pix";

          return (
            <div
              key={tx.id}
              className="bg-[hsl(var(--surface))] rounded-2xl shadow-terra p-4 flex items-center gap-4 hover:shadow-terra-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Ícone — círculo Terra: verde pra crédito, ocre/danger pra débito */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                isCredit ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'
              }`}>
                {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </div>

              {/* Detalhes */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[hsl(var(--text-primary))] truncate">
                  {tx.type === "purchase" ? tx.stall_name || "Compra na Barraca" :
                   tx.type === "recharge" ? (isPix ? "Recarga via PIX" : "Recarga Manual") :
                   tx.type === "refund" ? "Estorno" : "Transação"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))] mt-0.5">
                  <Clock className="w-3 h-3" />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tx.created_at != null ? (typeof (tx.created_at as any)?.toDate === 'function' ? formatDate((tx.created_at as any).toDate()) : formatDate(new Date(tx.created_at as string))) : ''}
                </div>
              </div>

              {/* Valor */}
              <div className="text-right">
                <p className={`font-bold whitespace-nowrap ${
                  isCredit ? 'text-primary' : 'text-[hsl(var(--text-primary))]'
                }`}>
                  {isCredit ? "+" : "-"}{formatCurrency(tx.amount_cents)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <Link
          href="/user/extrato"
          className="block w-full mt-1 py-3 px-4 rounded-2xl border border-dashed border-[hsl(var(--border))] hover:border-primary/60 hover:bg-primary/5 transition-colors text-center group"
        >
          <div className="flex items-center justify-center gap-2 text-[hsl(var(--text-secondary))] group-hover:text-primary transition-colors">
            <MoreHorizontal className="w-4 h-4" />
            <span className="text-sm font-medium">Ver extrato completo</span>
          </div>
        </Link>
      )}
    </div>
  );
}
