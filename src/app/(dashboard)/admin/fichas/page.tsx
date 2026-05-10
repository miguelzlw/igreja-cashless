"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  doc, collection, serverTimestamp, writeBatch, runTransaction
} from "firebase/firestore";
import { Printer, Loader2, ArrowLeft, Ticket, Info } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";

export default function FichasPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <FichasContent />
    </AuthGuard>
  );
}

function FichasContent() {
  const { user, userDoc } = useAuth();

  const [fichasQty, setFichasQty] = useState("10");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [lastBatch, setLastBatch] = useState<{ count: number; firstCode: string; lastCode: string } | null>(null);

  const generateFichas = async () => {
    const qty = parseInt(fichasQty);
    if (isNaN(qty) || qty < 1 || qty > 200) {
      setError("Quantidade deve ser entre 1 e 200.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      // Reservar uma faixa contígua de códigos via transação atômica no contador.
      // Garante que dois admins gerando lotes ao mesmo tempo recebam faixas
      // disjuntas — sem possibilidade de duplicata.
      const counterRef = doc(db, "counters", "temp_account_code");
      const startCode = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists() ? (snap.data().next as number) : 1;
        tx.set(counterRef, { next: current + qty }, { merge: true });
        return current;
      });

      // Pré-aloca os refs e códigos da faixa reservada
      const batch = writeBatch(db);
      const fichaIds: Array<{ id: string; code: string }> = [];

      for (let i = 0; i < qty; i++) {
        const ref = doc(collection(db, "temp_accounts"));
        const num = startCode + i;
        // 4 dígitos até 9999, depois expande automaticamente (5+ dígitos)
        const code = num <= 9999 ? String(num).padStart(4, "0") : String(num);

        batch.set(ref, {
          code,
          balance: 0,
          qr_hmac: `temp_${ref.id}`,
          created_by: user!.uid,
          created_at: serverTimestamp(),
          status: "active",
        });
        fichaIds.push({ id: ref.id, code });
      }

      await batch.commit();

      // Salva info do último lote pra mostrar resumo
      setLastBatch({
        count: qty,
        firstCode: fichaIds[0].code,
        lastCode: fichaIds[fichaIds.length - 1].code,
      });

      // Abre página de impressão em nova aba
      const params = encodeURIComponent(JSON.stringify(fichaIds));
      window.open(`/print/fichas?data=${params}`, "_blank");
    } catch (err) {
      console.error(err);
      setError("Erro ao gerar fichas. Verifique sua permissão e tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  if (!user || (userDoc?.role !== "admin" && userDoc?.role !== "desenvolvedor")) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Ticket className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Fichas Físicas</h1>
          <p className="text-xs text-[hsl(var(--text-secondary))]">Gerar e imprimir fichas com QR Code</p>
        </div>
      </header>

      {/* Card explicativo */}
      <div className="glass-card p-5 border border-primary/20 bg-primary/5">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-[hsl(var(--text-secondary))] space-y-2">
            <p className="font-bold text-[hsl(var(--text-primary))]">Como funciona</p>
            <ul className="space-y-1 text-xs leading-relaxed">
              <li>• Cada ficha começa com saldo <strong>R$ 0,00</strong></li>
              <li>• O caixa escaneia o QR e recarrega o valor pago pelo cliente</li>
              <li>• Vendedor escaneia o QR e debita o valor das compras</li>
              <li>• Útil para participantes que não têm smartphone</li>
              <li>• 6 fichas por folha A4</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="glass-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--text-primary))] mb-2">
            Quantidade de fichas
          </label>
          <input
            type="number"
            min="1"
            max="200"
            value={fichasQty}
            onChange={e => { setFichasQty(e.target.value); setError(""); }}
            disabled={generating}
            className="input text-lg font-bold h-14"
          />
          <p className="text-xs text-[hsl(var(--text-muted))] mt-1.5">
            Mínimo 1, máximo 200 por lote.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <button
          onClick={generateFichas}
          disabled={generating || !fichasQty}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Printer className="w-5 h-5" />
              Gerar e Abrir Impressão
            </>
          )}
        </button>
      </div>

      {/* Resumo do último lote */}
      {lastBatch && (
        <div className="glass-card p-5 border border-emerald-500/30 bg-emerald-500/5 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-emerald-500">Lote gerado!</p>
              <p className="text-xs text-[hsl(var(--text-secondary))]">A janela de impressão foi aberta em nova aba.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-[hsl(var(--bg))]/50">
              <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-wide">Quantidade</p>
              <p className="font-bold text-[hsl(var(--text-primary))]">{lastBatch.count}</p>
            </div>
            <div className="p-2 rounded-lg bg-[hsl(var(--bg))]/50">
              <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-wide">Primeiro</p>
              <p className="font-bold text-primary font-mono">#{lastBatch.firstCode}</p>
            </div>
            <div className="p-2 rounded-lg bg-[hsl(var(--bg))]/50">
              <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-wide">Último</p>
              <p className="font-bold text-primary font-mono">#{lastBatch.lastCode}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
