"use client";

import { useState, useEffect, useCallback } from "react";
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
  CheckCircle2, Copy, Clock
} from "lucide-react";

const PIX_AMOUNTS = [1000, 2000, 5000, 10000]; // centavos

export default function UserDashboard() {
  const { user, userDoc } = useAuth();
  const [isQROpen, setIsQROpen] = useState(false);
  const [isPixOpen, setIsPixOpen] = useState(false);

  // PIX
  const [pixAmount, setPixAmount] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState("");
  const [pixQrCode, setPixQrCode] = useState(""); // base64 image
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [pixPaymentId, setPixPaymentId] = useState("");
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Polling para verificar status do PIX
  useEffect(() => {
    if (!pixPaymentId || pixConfirmed) return;

    const interval = setInterval(async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const res = await fetch(`/api/pix/status?payment_id=${pixPaymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "CONFIRMED") {
            setPixConfirmed(true);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Erro ao verificar status PIX:", err);
      }
    }, 5000); // Verifica a cada 5 segundos

    return () => clearInterval(interval);
  }, [pixPaymentId, pixConfirmed]);

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

      setPixQrCode(data.qr_code);
      setPixCopyPaste(data.copy_paste);
      setPixPaymentId(data.payment_id);
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
    setPixConfirmed(false);
    setPixError("");
    setPixLoading(false);
    setCopied(false);
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

                {/* Timer */}
                <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--text-muted))]">
                  <Clock className="w-3 h-3" />
                  <span>Aguardando pagamento...</span>
                  <Loader2 className="w-3 h-3 animate-spin" />
                </div>
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
