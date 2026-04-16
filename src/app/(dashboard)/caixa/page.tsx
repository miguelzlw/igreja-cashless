"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  doc, getDoc, runTransaction, collection, serverTimestamp, writeBatch
} from "firebase/firestore";
import type { UserDoc } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  ScanLine, Wallet, CheckCircle2, Banknote, QrCode as QrCodeIcon,
  X, CreditCard, Loader2, ArrowLeft, Camera, Printer
} from "lucide-react";
import QRScanner from "@/components/shared/QRScanner";
import { playSuccessSound, playErrorSound } from "@/lib/utils/sounds";
import { vibrateSuccess, vibrateError, vibrateLight } from "@/lib/utils/vibration";

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

export default function CaixaDashboard() {
  const { user, userDoc } = useAuth();

  // Escaneamento
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  // Cliente selecionado
  const [customer, setCustomer] = useState<{ uid: string; data: UserDoc; rawPayload: string } | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  // Recarga
  const [amountInput, setAmountInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [transactionError, setTransactionError] = useState("");

  // Fichas físicas
  const [showFichasModal, setShowFichasModal] = useState(false);
  const [fichasQty, setFichasQty] = useState("10");
  const [generatingFichas, setGeneratingFichas] = useState(false);

  // ── Scan QR ─────────────────────────────────────────────

  const handleScanSuccess = async (decodedText: string) => {
    vibrateLight();
    const parts = decodedText.split(":");
    if (parts.length !== 2) {
      setScanError("QR Code inválido.");
      playErrorSound();
      vibrateError();
      return;
    }

    const uid = parts[0];
    setIsScanning(false);
    setIsLoadingCustomer(true);
    setScanError("");

    try {
      const docRef = doc(db, "users", uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error("Cliente não encontrado.");
      setCustomer({ uid, data: snap.data() as UserDoc, rawPayload: decodedText });
      playSuccessSound();
    } catch (err: unknown) {
      console.error(err);
      setScanError("Erro ao buscar dados do cliente.");
      playErrorSound();
      vibrateError();
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  // ── Recarga ──────────────────────────────────────────────

  const handleManualRecharge = async () => {
    if (!customer) return;
    const amountCents = parseInt(amountInput.replace(/\D/g, ""));
    if (isNaN(amountCents) || amountCents < 500) {
      setTransactionError("Valor inválido. O mínimo é R$ 5,00.");
      return;
    }

    setIsProcessing(true);
    setTransactionError("");
    setSuccessMessage("");

    try {
      await runTransaction(db, async (tx) => {
        const customerRef = doc(db, "users", customer.uid);
        const customerSnap = await tx.get(customerRef);
        if (!customerSnap.exists()) throw new Error("Cliente não encontrado.");
        const customerData = customerSnap.data();

        tx.update(customerRef, {
          balance: customerData.balance + amountCents,
          updated_at: serverTimestamp(),
        });

        const txRef = doc(collection(db, "transactions"));
        tx.set(txRef, {
          type: "recharge",
          amount_cents: amountCents,
          user_id: customer.uid,
          user_name: customerData.name,
          operator_id: user!.uid,
          operator_name: userDoc?.name || "Caixa",
          payment_method: "cash",
          status: "completed",
          created_at: serverTimestamp(),
        });
      });

      setSuccessMessage(`Recarga de ${formatCurrency(amountCents)} aplicada! Saldo atual: ${formatCurrency(customer.data.balance + amountCents)}`);
      playSuccessSound();
      vibrateSuccess();
      setCustomer(prev =>
        prev ? { ...prev, data: { ...prev.data, balance: prev.data.balance + amountCents } } : prev
      );
      setAmountInput("");
    } catch (err: unknown) {
      console.error(err);
      setTransactionError(err instanceof Error ? err.message : "Erro ao processar recarga.");
      playErrorSound();
      vibrateError();
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Fichas Físicas ───────────────────────────────────────

  const generateFichas = async () => {
    const qty = parseInt(fichasQty);
    if (isNaN(qty) || qty < 1 || qty > 200) return;

    setGeneratingFichas(true);
    try {
      const batch = writeBatch(db);
      const fichaIds: Array<{ id: string; code: string }> = [];

      for (let i = 0; i < qty; i++) {
        const ref = doc(collection(db, "temp_accounts"));
        const code = String(Math.floor(Math.random() * 9000) + 1000); // 4 dígitos
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

      // Abre página de impressão
      const params = encodeURIComponent(JSON.stringify(fichaIds));
      window.open(`/print/fichas?data=${params}`, "_blank");
      setShowFichasModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingFichas(false);
    }
  };

  const resetCustomer = () => {
    setCustomer(null);
    setAmountInput("");
    setSuccessMessage("");
    setTransactionError("");
    setIsScanning(true);
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Caixa de Recarga</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Adicione créditos aos participantes.</p>
        </div>
        <button
          onClick={() => setShowFichasModal(true)}
          className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors font-medium"
        >
          <Printer className="w-4 h-4" />
          Fichas
        </button>
      </header>

      {/* TELA 1: SCANNER */}
      {!customer && (
        <section className="space-y-4 animate-slide-up">
          {scanError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-center justify-between">
              {scanError}
              <button onClick={() => setScanError("")}><X className="w-4 h-4" /></button>
            </div>
          )}

          {isLoadingCustomer ? (
            <div className="glass-card min-h-[300px] flex flex-col items-center justify-center p-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-[hsl(var(--text-primary))] font-medium">Buscando cliente...</p>
            </div>
          ) : isScanning ? (
            <div className="space-y-4">
              <QRScanner onScanSuccess={handleScanSuccess} />
              <button onClick={() => setIsScanning(false)} className="w-full p-4 rounded-xl border-2 border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-medium hover:bg-[hsl(var(--card))]/50 transition-colors">
                Cancelar Câmera
              </button>
            </div>
          ) : (
            <div className="glass-card min-h-[300px] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <ScanLine className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">Aguardando Cliente</h2>
              <p className="text-[hsl(var(--text-secondary))] text-sm mb-8">
                Peça ao cliente para mostrar o QR Code dele.
              </p>
              <button onClick={() => setIsScanning(true)} className="btn-primary w-full shadow-lg shadow-primary/20 flex items-center gap-2 justify-center py-4 text-lg">
                <Camera className="w-6 h-6" />
                Ver Saldo / Nova Recarga
              </button>
            </div>
          )}
        </section>
      )}

      {/* TELA 2: RECARGA */}
      {customer && (
        <section className="space-y-6 animate-slide-up">
          <div className="flex items-center gap-4">
            <button onClick={resetCustomer} className="p-2 rounded-full hover:bg-[hsl(var(--card))] text-[hsl(var(--text-secondary))] transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-[hsl(var(--text-primary))]">Fazer Recarga</h2>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-primary">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1">Cliente</p>
            <h3 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-4">{customer.data.name}</h3>
            <div className="flex items-center justify-between p-4 bg-[hsl(var(--bg))]/50 rounded-xl">
              <span className="text-[hsl(var(--text-secondary))] text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Saldo Atual
              </span>
              <span className="font-bold text-lg text-primary">{formatCurrency(customer.data.balance)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-[hsl(var(--text-primary))]">1. Selecione o valor:</p>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmountInput(formatCurrency(amt).replace("R$", "").trim())}
                  className="p-4 rounded-xl border border-[hsl(var(--border))] hover:border-primary hover:bg-primary/5 text-center text-lg font-bold text-[hsl(var(--text-primary))] transition-colors"
                >
                  +{formatCurrency(amt).replace("R$", "").trim()}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] font-medium">R$</span>
              <input
                type="text"
                className="input text-lg font-bold pl-12 h-14"
                placeholder="Outro valor..."
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
              />
            </div>
          </div>

          {transactionError && (
            <div className="p-4 rounded-xl bg-danger/10 text-danger text-sm border border-danger/20 font-medium">{transactionError}</div>
          )}
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-500 text-sm border border-emerald-500/20 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> {successMessage}
            </div>
          )}

          <div className="pt-6 border-t border-[hsl(var(--border))]/50 space-y-4">
            <p className="text-sm font-medium text-[hsl(var(--text-primary))] mb-4">2. Confirmar Pagamento:</p>
            <button
              onClick={handleManualRecharge}
              disabled={isProcessing || !amountInput}
              className="btn-primary w-full py-4 text-base flex flex-col items-center justify-center gap-1 group"
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5" />
                    <CreditCard className="w-5 h-5" />
                    Confirmar Recarga — Cédula/Cartão
                  </div>
                  <span className="text-xs text-white/70 font-normal">O valor será lançado na conta do cliente.</span>
                </>
              )}
            </button>

            <button disabled className="w-full py-4 rounded-xl bg-[#00B1EA]/10 text-[#00B1EA] font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-50">
              <QrCodeIcon className="w-5 h-5" />
              Gerar PIX Nativo (Em Breve)
            </button>
          </div>
        </section>
      )}

      {/* Modal Fichas Físicas */}
      {showFichasModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !generatingFichas && setShowFichasModal(false)} />
          <div className="relative w-full max-w-sm glass-card p-6 animate-slide-up shadow-2xl rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Gerar Fichas Físicas</h3>
              <button onClick={() => setShowFichasModal(false)} disabled={generatingFichas} className="p-1.5 rounded-full hover:bg-[hsl(var(--bg))]">
                <X className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
              </button>
            </div>

            <p className="text-sm text-[hsl(var(--text-secondary))]">
              Gera fichas com QR Code para quem não tem smartphone. Cada ficha começa com <strong>saldo R$ 0,00</strong> e o caixa recarrega ao receber o pagamento.
            </p>

            <div>
              <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1">
                Quantidade de fichas (máx. 200)
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={fichasQty}
                onChange={e => setFichasQty(e.target.value)}
                className="input"
              />
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Serão impressas 6 fichas por folha A4</p>
            </div>

            <button
              onClick={generateFichas}
              disabled={generatingFichas}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {generatingFichas ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Gerar e Abrir Impressão
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
