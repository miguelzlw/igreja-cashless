"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import { auth } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, orderBy, getDocs } from "firebase/firestore";
import type { ProductDoc, StallDoc } from "@/lib/types";
import UserBalanceCard from "@/components/user/UserBalanceCard";
import QRCodeModal from "@/components/user/QRCodeModal";
import TransactionHistory from "@/components/user/TransactionHistory";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  QrCode, BookOpen, Store, Loader2, ChevronDown, ChevronUp, X,
  CheckCircle2, Copy, Clock, RefreshCw, AlertTriangle
} from "lucide-react";

const PIX_AMOUNTS = [1000, 2000, 5000, 10000]; // centavos
const PIX_SESSION_KEY = "pix:active";

interface ActivePix {
  payment_id: string;
  qr_code: string;
  copy_paste: string;
  amount_cents: number;
  expires_at: number; // epoch ms
}

function loadActivePix(): ActivePix | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PIX_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivePix;
    if (!parsed.payment_id || !parsed.expires_at || parsed.expires_at < Date.now()) {
      window.sessionStorage.removeItem(PIX_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveActivePix(pix: ActivePix | null) {
  if (typeof window === "undefined") return;
  try {
    if (pix) {
      window.sessionStorage.setItem(PIX_SESSION_KEY, JSON.stringify(pix));
    } else {
      window.sessionStorage.removeItem(PIX_SESSION_KEY);
    }
  } catch {
    // sessionStorage indisponível — segue sem persistir
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function UserDashboard() {
  const { user, userDoc } = useAuth();
  const [isQROpen, setIsQROpen] = useState(false);
  const [isPixOpen, setIsPixOpen] = useState(false);

  // PIX — estado
  const [pixAmount, setPixAmount] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState("");
  const [pixQrCode, setPixQrCode] = useState(""); // base64 image
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [pixPaymentId, setPixPaymentId] = useState("");
  const [pixExpiresAt, setPixExpiresAt] = useState<number | null>(null);
  const [pixExpired, setPixExpired] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [pixRemainingMs, setPixRemainingMs] = useState(0);
  const [manualChecking, setManualChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollAttemptsRef = useRef(0);

  // Cardápio
  interface StallWithProducts extends StallDoc { id: string; products: ProductDoc[]; }
  const [menu, setMenu] = useState<StallWithProducts[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [expandedStall, setExpandedStall] = useState<string | null>(null);

  useEffect(() => {
    const qStalls = query(collection(db, "stalls"), where("is_active", "==", true));
    const unsubStalls = onSnapshot(qStalls, async (stallSnap) => {
      const stallsData: StallWithProducts[] = [];

      for (const stallDoc of stallSnap.docs) {
        const stallData = stallDoc.data() as StallDoc;
        const qProducts = query(
          collection(db, "stalls", stallDoc.id, "products"),
          orderBy("name", "asc")
        );

        const productsSnap = await getDocs(qProducts);
        const activeProducts = productsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as ProductDoc))
            .filter(p => p.active);

        stallsData.push({
          id: stallDoc.id,
          ...stallData,
          products: activeProducts,
        });
      }
      setMenu(stallsData);
      setMenuLoading(false);
    }, () => setMenuLoading(false));

    return () => unsubStalls();
  }, []);

  // Restaura PIX ativo do sessionStorage no mount
  useEffect(() => {
    const saved = loadActivePix();
    if (saved) {
      setPixPaymentId(saved.payment_id);
      setPixQrCode(saved.qr_code);
      setPixCopyPaste(saved.copy_paste);
      setPixAmount(String(saved.amount_cents));
      setPixExpiresAt(saved.expires_at);
      setIsPixOpen(true);
    }
  }, []);

  // Countdown do timer (1 Hz)
  useEffect(() => {
    if (!pixExpiresAt || pixConfirmed) return;
    const tick = () => {
      const remaining = pixExpiresAt - Date.now();
      setPixRemainingMs(remaining);
      if (remaining <= 0) {
        setPixExpired(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pixExpiresAt, pixConfirmed]);

  // Verifica status do PIX uma vez (manual ou polling)
  const checkPixStatus = useCallback(async (): Promise<"CONFIRMED" | "PENDING" | "ERROR"> => {
    if (!pixPaymentId) return "ERROR";
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return "ERROR";
      const res = await fetch(`/api/pix/status?payment_id=${pixPaymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return "ERROR";
      const data = await res.json();
      return data.status === "CONFIRMED" ? "CONFIRMED" : "PENDING";
    } catch (err) {
      console.error("Erro ao verificar status PIX:", err);
      return "ERROR";
    }
  }, [pixPaymentId]);

  // Polling com backoff: 5s × 12 (1 min) → 10s × 12 (2 min) → 20s × 6 (2 min) → para
  useEffect(() => {
    if (!pixPaymentId || pixConfirmed || pixExpired) return;

    let cancelled = false;
    pollAttemptsRef.current = 0;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      const timeout = setTimeout(async () => {
        if (cancelled) return;
        const result = await checkPixStatus();
        if (cancelled) return;
        if (result === "CONFIRMED") {
          setPixConfirmed(true);
          saveActivePix(null);
          return;
        }
        pollAttemptsRef.current += 1;
        const next = pollAttemptsRef.current;
        // Backoff
        let nextDelay: number;
        if (next < 12) nextDelay = 5000;        // até 1 min
        else if (next < 24) nextDelay = 10000;  // até 3 min
        else if (next < 30) nextDelay = 20000;  // até 5 min
        else return; // para após ~5 min; usuário pode usar "Já paguei"
        schedule(nextDelay);
      }, delayMs);
      timeoutRefs.current.push(timeout);
    };

    const timeoutRefs = { current: [] as ReturnType<typeof setTimeout>[] };
    schedule(5000);

    return () => {
      cancelled = true;
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, [pixPaymentId, pixConfirmed, pixExpired, checkPixStatus]);

  const handleManualCheck = async () => {
    setManualChecking(true);
    const result = await checkPixStatus();
    setManualChecking(false);
    if (result === "CONFIRMED") {
      setPixConfirmed(true);
      saveActivePix(null);
    } else if (result === "ERROR") {
      setPixError("Não foi possível verificar agora. Tente novamente em alguns segundos.");
    } else {
      setPixError("Pagamento ainda não foi recebido. Aguarde o webhook do Asaas ou tente de novo.");
    }
  };

  const handleGeneratePix = useCallback(async () => {
    const amountCents = parseInt(pixAmount.replace(/\D/g, ""));
    if (isNaN(amountCents) || amountCents < 500) {
      setPixError("Valor mínimo: R$ 5,00");
      return;
    }

    setPixLoading(true);
    setPixError("");
    setPixQrCode("");
    setPixCopyPaste("");
    setPixConfirmed(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Não autenticado");

      const res = await fetch("/api/pix/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount_cents: amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar PIX");
      }

      const expiresAt = Date.now() + (data.expires_in_minutes || 30) * 60 * 1000;
      setPixQrCode(data.qr_code);
      setPixCopyPaste(data.copy_paste);
      setPixPaymentId(data.payment_id);
      setPixExpiresAt(expiresAt);
      setPixExpired(false);
      saveActivePix({
        payment_id: data.payment_id,
        qr_code: data.qr_code,
        copy_paste: data.copy_paste,
        amount_cents: amountCents,
        expires_at: expiresAt,
      });
    } catch (err: unknown) {
      setPixError(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setPixLoading(false);
    }
  }, [pixAmount]);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback para mobile
      const textarea = document.createElement("textarea");
      textarea.value = pixCopyPaste;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const resetPix = () => {
    setPixAmount("");
    setPixQrCode("");
    setPixCopyPaste("");
    setPixPaymentId("");
    setPixExpiresAt(null);
    setPixExpired(false);
    setPixConfirmed(false);
    setPixError("");
    setPixLoading(false);
    setCopied(false);
    setManualChecking(false);
    pollAttemptsRef.current = 0;
    saveActivePix(null);
  };

  const closePixModal = () => {
    setIsPixOpen(false);
    resetPix();
  };

  if (!user || !userDoc) return null;

  const qrPayload = `${user.uid}:${userDoc.qr_hmac}`;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
          Olá, {userDoc.name.split(" ")[0]}! 👋
        </h1>
        <p className="text-[hsl(var(--text-secondary))] text-sm">
          Aproveite a festa!
        </p>
      </header>

      {/* Saldo e Ações */}
      <section>
        <UserBalanceCard
          balanceCents={userDoc.balance}
          onOpenQR={() => setIsQROpen(true)}
        />
      </section>

      {/* Botão de Recarga PIX */}
      <section>
        <button
          onClick={() => setIsPixOpen(true)}
          className="w-full glass-card p-4 flex items-center justify-between hover:border-[#00B1EA]/40 hover:bg-[#00B1EA]/5 transition-all group border border-[hsl(var(--border))]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00B1EA]/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-[#00B1EA]" />
            </div>
            <div className="text-left">
              <p className="font-bold text-[hsl(var(--text-primary))]">Recarregar via PIX</p>
              <p className="text-xs text-[hsl(var(--text-secondary))]">Adicione saldo instantaneamente</p>
            </div>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-medium">Disponível</span>
        </button>
      </section>

      {/* Histórico */}
      <section>
        <TransactionHistory userId={user.uid} />
      </section>

      {/* Cardápio da Festa */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-[hsl(var(--text-primary))]">Cardápio</h2>
        </div>
        <p className="text-sm text-[hsl(var(--text-secondary))]">
          Veja o que cada barraca está servindo e os preços antes de ir até lá!
        </p>

        {menuLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : menu.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma barraca disponível ainda.</p>
          </div>
        ) : (
          menu.map(stall => (
            <div key={stall.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedStall(expandedStall === stall.id ? null : stall.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--card))]/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-[hsl(var(--text-primary))]">{stall.name}</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">
                      {stall.products.length} ite{stall.products.length !== 1 ? "ns" : "m"}
                    </p>
                  </div>
                </div>
                {expandedStall === stall.id
                  ? <ChevronUp className="w-5 h-5 text-[hsl(var(--text-muted))]" />
                  : <ChevronDown className="w-5 h-5 text-[hsl(var(--text-muted))]" />
                }
              </button>

              {expandedStall === stall.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-[hsl(var(--border))]/50">
                  {stall.products.length === 0 ? (
                    <p className="text-sm text-center text-[hsl(var(--text-muted))] py-3">Nenhum produto cadastrado.</p>
                  ) : (
                    stall.products.map(product => (
                      <div key={product.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          {product.emoji && <span className="text-xl">{product.emoji}</span>}
                          <div>
                            <p className="font-medium text-[hsl(var(--text-primary))] text-sm">{product.name}</p>
                            {product.stock === 0 && (
                              <span className="text-xs text-danger font-medium">Esgotado</span>
                            )}
                          </div>
                        </div>
                        <p className="font-bold text-primary">{formatCurrency(product.price_cents)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        qrPayload={qrPayload}
        userName={userDoc.name}
      />

      {/* Modal PIX Funcional */}
      {isPixOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePixModal} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 animate-slide-up shadow-2xl space-y-4">
            <button onClick={closePixModal} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[hsl(var(--bg))]">
              <X className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
            </button>

            {/* Estado: PIX Confirmado */}
            {pixConfirmed ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">PIX Confirmado!</h3>
                <p className="text-[hsl(var(--text-secondary))] text-sm">
                  Seu saldo foi atualizado automaticamente.
                </p>
                <button onClick={closePixModal} className="btn-primary w-full py-3">
                  Voltar
                </button>
              </div>
            ) : pixExpired ? (
              /* Estado: PIX expirou */
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                </div>
                <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">PIX expirado</h3>
                <p className="text-sm text-[hsl(var(--text-secondary))]">
                  Esse código de PIX passou da validade. Gere um novo para continuar.
                </p>
                <button onClick={resetPix} className="btn-primary w-full py-3">
                  Gerar novo PIX
                </button>
              </div>
            ) : pixQrCode ? (
              /* Estado: QR Code gerado, aguardando pagamento */
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Pague com PIX</h3>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">
                    Escaneie o QR Code ou copie o código
                  </p>
                </div>

                {/* QR Code */}
                <div className="bg-white rounded-xl p-4 mx-auto w-fit">
                  <img
                    src={`data:image/png;base64,${pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto"
                  />
                </div>

                {/* Valor */}
                <div className="text-center">
                  <span className="text-2xl font-black text-primary">
                    {formatCurrency(parseInt(pixAmount.replace(/\D/g, "")))}
                  </span>
                </div>

                {/* Copia e Cola */}
                <button
                  onClick={handleCopyPix}
                  className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    copied
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--text-primary))] hover:border-primary/50"
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Código copiado!" : "Copiar código PIX"}
                </button>

                {/* Timer com countdown */}
                <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--text-muted))]">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expira em{" "}
                    <span className={`font-mono font-semibold ${pixRemainingMs < 60_000 ? "text-warning" : "text-[hsl(var(--text-secondary))]"}`}>
                      {formatRemaining(pixRemainingMs)}
                    </span>
                  </span>
                </div>

                {/* Botão "Já paguei" */}
                <button
                  onClick={handleManualCheck}
                  disabled={manualChecking}
                  className="w-full py-2 rounded-xl text-xs font-medium border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:border-primary/50 flex items-center justify-center gap-2 transition-all"
                >
                  {manualChecking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {manualChecking ? "Verificando..." : "Já paguei, verificar agora"}
                </button>

                {pixError && (
                  <p className="text-xs text-warning bg-warning/10 p-2 rounded-lg text-center">{pixError}</p>
                )}
              </div>
            ) : (
              /* Estado: Seleção de valor */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-[#00B1EA]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <QrCode className="w-7 h-7 text-[#00B1EA]" />
                  </div>
                  <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Recarga via PIX</h3>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">Escolha o valor da recarga</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PIX_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPixAmount(String(amt))}
                      className={`py-3 rounded-xl text-center font-bold transition-all border ${
                        pixAmount === String(amt)
                          ? "bg-primary text-white border-primary"
                          : "border-[hsl(var(--border))] text-[hsl(var(--text-primary))] hover:border-primary/50"
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] font-medium">R$</span>
                  <input
                    type="text"
                    className="input text-lg font-bold pl-12 h-14"
                    placeholder="Outro valor..."
                    value={pixAmount ? formatCurrency(parseInt(pixAmount)).replace("R$", "").trim() : ""}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "");
                      setPixAmount(v ? String(parseInt(v) * 100) : "");
                    }}
                  />
                </div>

                {pixError && (
                  <p className="text-sm text-danger bg-danger/10 p-2 rounded-lg text-center">{pixError}</p>
                )}

                <button
                  onClick={handleGeneratePix}
                  disabled={pixLoading || !pixAmount}
                  className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
                >
                  {pixLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      Gerar QR Code PIX
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
