"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import type { ProductDoc, StallDoc } from "@/lib/types";
import UserBalanceCard from "@/components/user/UserBalanceCard";
import QRCodeModal from "@/components/user/QRCodeModal";
import TransactionHistory from "@/components/user/TransactionHistory";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  QrCode, BookOpen, Store, Loader2, ChevronDown, ChevronUp, X
} from "lucide-react";

export default function UserDashboard() {
  const { user, userDoc } = useAuth();
  const [isQROpen, setIsQROpen] = useState(false);
  const [isPixOpen, setIsPixOpen] = useState(false);

  // Cardápio
  interface StallWithProducts extends StallDoc { id: string; products: ProductDoc[]; }
  const [menu, setMenu] = useState<StallWithProducts[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [expandedStall, setExpandedStall] = useState<string | null>(null);

  useEffect(() => {
    // Carrega todas as barracas ativas
    const qStalls = query(collection(db, "stalls"), where("is_active", "==", true));
    const unsub = onSnapshot(qStalls, async (stallSnap) => {
      const stallsData: StallWithProducts[] = [];

      for (const stallDoc of stallSnap.docs) {
        const stallData = stallDoc.data() as StallDoc;
        // Carrega produtos de cada barraca
        const qProducts = query(
          collection(db, "stalls", stallDoc.id, "products"),
          where("active", "==", true),
          orderBy("name", "asc")
        );
        const productsSnap = await new Promise<ProductDoc[]>(resolve => {
          onSnapshot(qProducts, snap => {
            resolve(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDoc)));
          });
        });

        stallsData.push({
          id: stallDoc.id,
          ...stallData,
          products: productsSnap,
        });
      }
      setMenu(stallsData);
      setMenuLoading(false);
    }, () => setMenuLoading(false));

    return () => unsub();
  }, []);

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
          className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 hover:bg-primary/5 transition-all group border border-[hsl(var(--border))]"
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
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">Em breve</span>
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

      {/* Modal PIX Em Breve */}
      {isPixOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPixOpen(false)} />
          <div className="relative w-full max-w-sm glass-card p-6 animate-slide-up shadow-2xl rounded-2xl space-y-4 text-center">
            <button onClick={() => setIsPixOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[hsl(var(--bg))]">
              <X className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
            </button>
            <div className="w-16 h-16 bg-[#00B1EA]/10 rounded-full flex items-center justify-center mx-auto">
              <QrCode className="w-8 h-8 text-[#00B1EA]" />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--text-primary))]">Recarga via PIX</h3>
            <p className="text-[hsl(var(--text-secondary))] text-sm">
              A integração automática com PIX estará disponível em breve!
            </p>
            <p className="text-sm text-[hsl(var(--text-secondary))] bg-[hsl(var(--card))] rounded-xl p-3">
              Por enquanto, vá até um <strong>Caixa</strong> presencialmente para recarregar com dinheiro ou cartão. O caixa aplica o saldo na hora!
            </p>
            <button onClick={() => setIsPixOpen(false)} className="btn-primary w-full py-3">
              Entendido!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
