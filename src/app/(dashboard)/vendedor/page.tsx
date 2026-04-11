"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  collection, onSnapshot, query, orderBy,
  runTransaction, doc, serverTimestamp, increment, where
} from "firebase/firestore";
import type { ProductDoc, CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  ShoppingCart, Store, CheckCircle2, X, Loader2,
  Plus, Minus, Trash2, ScanLine, AlertTriangle, PackageX
} from "lucide-react";
import QRScanner from "@/components/shared/QRScanner";
import { playSuccessSound, playErrorSound } from "@/lib/utils/sounds";
import { vibrateSuccess, vibrateError, vibrateLight } from "@/lib/utils/vibration";

export default function VendedorDashboard() {
  const { user, userDoc } = useAuth();

  // Produtos da barraca
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Fluxo de checkout
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Carregar produtos da barraca em tempo real
  useEffect(() => {
    if (!userDoc?.stall_id) {
      setLoadingProducts(false);
      return;
    }

    const q = query(
      collection(db, "stalls", userDoc.stall_id, "products"),
      where("active", "==", true),
      orderBy("name", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: ProductDoc[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ProductDoc));
      setProducts(list);
      setLoadingProducts(false);
    }, (err) => {
      console.error("Erro ao carregar produtos:", err);
      setLoadingProducts(false);
    });

    return () => unsub();
  }, [userDoc?.stall_id]);

  // ── Funções do carrinho ──────────────────────────────────

  const addToCart = (product: ProductDoc) => {
    vibrateLight();
    if (product.stock === 0) return;

    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id!);
      if (existing) {
        // Verifica se há estoque suficiente
        if (product.stock !== -1 && existing.quantity >= product.stock) {
          return prev;
        }
        return prev.map(i =>
          i.product_id === product.id!
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id!,
          name: product.name,
          emoji: product.emoji,
          price_cents: product.price_cents,
          quantity: 1,
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    vibrateLight();
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const changeQty = (productId: string, delta: number) => {
    vibrateLight();
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId);
      if (!item) return prev;

      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.product_id !== productId);

      // Limite de estoque
      const product = products.find(p => p.id === productId);
      if (product && product.stock !== -1 && newQty > product.stock) return prev;

      return prev.map(i =>
        i.product_id === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const resetAll = useCallback(() => {
    setCart([]);
    setShowCart(false);
    setIsScanning(false);
    setSuccessMessage("");
    setErrorMessage("");
    setIsProcessing(false);
  }, []);

  // ── Checkout via QR Code ─────────────────────────────────

  const startCheckout = () => {
    if (cart.length === 0) return;
    setErrorMessage("");
    setSuccessMessage("");
    setShowCart(false);
    setIsScanning(true);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const parts = decodedText.split(":");
    if (parts.length !== 2) {
      setErrorMessage("QR Code inválido.");
      playErrorSound();
      vibrateError();
      return;
    }

    setIsScanning(false);
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const customerId = parts[0];
      const amountCents = cartTotal;

      await runTransaction(db, async (tx) => {
        const customerRef = doc(db, "users", customerId);
        const customerSnap = await tx.get(customerRef);

        if (!customerSnap.exists()) throw new Error("Cliente não encontrado.");
        const customerData = customerSnap.data();

        if (customerData.balance < amountCents) {
          throw new Error(`Saldo insuficiente. Disponível: ${formatCurrency(customerData.balance)}`);
        }

        // Verificar e decrementar estoque de cada produto
        for (const item of cart) {
          if (item.product_id) {
            const productRef = doc(db, "stalls", userDoc!.stall_id!, "products", item.product_id);
            const productSnap = await tx.get(productRef);
            if (productSnap.exists()) {
              const pData = productSnap.data();
              if (pData.stock !== -1) {
                if (pData.stock < item.quantity) {
                  throw new Error(`"${item.name}" não tem estoque suficiente.`);
                }
                tx.update(productRef, { stock: increment(-item.quantity) });
              }
            }
          }
        }

        // Debitar cliente
        tx.update(customerRef, {
          balance: customerData.balance - amountCents,
          updated_at: serverTimestamp(),
        });

        // Registrar transação
        const txRef = doc(collection(db, "transactions"));
        tx.set(txRef, {
          type: "purchase",
          amount_cents: amountCents,
          user_id: customerId,
          user_name: customerData.name,
          stall_id: userDoc!.stall_id,
          stall_name: userDoc!.stall_name || "Barraca",
          operator_id: user!.uid,
          operator_name: userDoc!.name,
          items: cart.map(i => ({
            product_id: i.product_id,
            name: i.name,
            emoji: i.emoji || "",
            price_cents: i.price_cents,
            quantity: i.quantity,
          })),
          payment_method: "balance",
          status: "completed",
          created_at: serverTimestamp(),
        });

        // Creditar barraca
        const stallRef = doc(db, "stalls", userDoc!.stall_id!);
        tx.update(stallRef, { total_sales_cents: increment(amountCents) });
      });

      setSuccessMessage(
        `${formatCurrency(amountCents)} cobrado com sucesso! (${cartCount} ite${cartCount > 1 ? "ns" : "m"})`
      );
      setCart([]);
      playSuccessSound();
      vibrateSuccess();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Erro ao processar venda.");
      playErrorSound();
      vibrateError();
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Renderização ─────────────────────────────────────────

  if (!user || !userDoc) return null;

  // Sem barraca atribuída
  if (!userDoc.stall_id) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">Sem Barraca Atribuída</h2>
        <p className="text-[hsl(var(--text-secondary))] text-sm">
          Peça ao Gerente ou Admin para te vincular a uma barraca antes de começar a vender.
        </p>
      </div>
    );
  }

  // Tela de Sucesso
  if (successMessage) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-emerald-500 mb-2">Aprovado!</h2>
        <p className="text-[hsl(var(--text-secondary))] mb-8">{successMessage}</p>
        <button onClick={resetAll} className="btn-primary w-full py-4 text-lg">
          Nova Venda
        </button>
      </div>
    );
  }

  // Tela de Processando
  if (isProcessing) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-[hsl(var(--text-primary))] font-medium text-xl">Processando venda...</p>
        {errorMessage && (
          <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-center w-full">
            {errorMessage}
            <button onClick={() => { setErrorMessage(""); setIsProcessing(false); }} className="block mx-auto mt-3 font-bold underline text-sm">
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  }

  // Tela de Scanner
  if (isScanning) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4 animate-slide-up">
        <div className="glass-card p-4 border-l-4 border-l-primary flex items-center justify-between">
          <span className="text-[hsl(var(--text-secondary))] text-sm">Total a cobrar:</span>
          <span className="text-2xl font-black text-primary">{formatCurrency(cartTotal)}</span>
        </div>
        {errorMessage && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center justify-between">
            {errorMessage}
            <button onClick={() => setErrorMessage("")}><X className="w-4 h-4" /></button>
          </div>
        )}
        <QRScanner onScanSuccess={handleScanSuccess} />
        <button onClick={() => { setIsScanning(false); setShowCart(true); }} className="w-full p-4 rounded-xl border-2 border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-medium">
          Voltar ao Carrinho
        </button>
      </div>
    );
  }

  // Tela do Carrinho
  if (showCart) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4 animate-slide-up pb-32">
        <header className="flex items-center gap-3">
          <button onClick={() => setShowCart(false)} className="p-2 rounded-full hover:bg-[hsl(var(--card))]">
            <X className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
          </button>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Carrinho</h1>
        </header>

        {cart.length === 0 ? (
          <div className="glass-card p-8 text-center text-[hsl(var(--text-muted))]">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Carrinho vazio</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.product_id} className="glass-card p-4 flex items-center gap-3">
                {item.emoji && <span className="text-3xl">{item.emoji}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[hsl(var(--text-primary))] truncate">{item.name}</p>
                  <p className="text-sm text-primary font-medium">
                    {formatCurrency(item.price_cents)} × {item.quantity} = {formatCurrency(item.price_cents * item.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(item.product_id, -1)} className="w-8 h-8 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center hover:border-danger hover:text-danger transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-[hsl(var(--text-primary))]">{item.quantity}</span>
                  <button onClick={() => changeQty(item.product_id, 1)} className="w-8 h-8 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeFromCart(item.product_id)} className="w-8 h-8 rounded-full flex items-center justify-center text-danger hover:bg-danger/10 transition-colors ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[hsl(var(--bg))]/90 backdrop-blur border-t border-[hsl(var(--border))]/50 space-y-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <span className="text-[hsl(var(--text-secondary))] font-medium">Total ({cartCount} itens)</span>
            <span className="text-2xl font-black text-primary">{formatCurrency(cartTotal)}</span>
          </div>
          <button
            onClick={startCheckout}
            disabled={cart.length === 0}
            className="btn-primary w-full max-w-md mx-auto py-4 text-lg flex items-center justify-center gap-2"
          >
            <ScanLine className="w-5 h-5" />
            Escanear QR do Cliente
          </button>
        </div>
      </div>
    );
  }

  // Tela Principal — Grade de Produtos
  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-32 animate-fade-in">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">PDV</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm flex items-center gap-1">
            <Store className="w-4 h-4" />
            {userDoc.stall_name || "Barraca"}
          </p>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center justify-between">
          {errorMessage}
          <button onClick={() => setErrorMessage("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loadingProducts ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="glass-card p-8 text-center text-[hsl(var(--text-muted))]">
          <PackageX className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">O Gerente da barraca precisa adicionar produtos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(product => {
            const inCart = cart.find(i => i.product_id === product.id);
            const outOfStock = product.stock === 0;
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={outOfStock}
                className={`relative glass-card p-4 flex flex-col items-center justify-center text-center rounded-2xl border transition-all active:scale-95 min-h-[120px] ${
                  outOfStock
                    ? "opacity-50 cursor-not-allowed border-[hsl(var(--border))]"
                    : inCart
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-[hsl(var(--border))] hover:border-primary/50"
                }`}
              >
                {inCart && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full text-xs text-white font-bold flex items-center justify-center">
                    {inCart.quantity}
                  </span>
                )}
                {outOfStock && (
                  <span className="absolute top-2 left-2 text-xs bg-danger/10 text-danger px-1.5 py-0.5 rounded font-medium">
                    Esgotado
                  </span>
                )}
                {product.emoji && (
                  <span className="text-4xl mb-2">{product.emoji}</span>
                )}
                <p className="font-bold text-[hsl(var(--text-primary))] text-sm leading-tight">{product.name}</p>
                <p className="text-primary font-black mt-1">{formatCurrency(product.price_cents)}</p>
                {product.stock !== -1 && product.stock > 0 && product.stock <= 5 && (
                  <p className="text-xs text-warning mt-0.5">Restam {product.stock}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de Carrinho Flutuante */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 animate-slide-up">
          <button
            onClick={() => setShowCart(true)}
            className="btn-primary w-full max-w-md mx-auto py-4 text-lg flex items-center justify-between px-6 shadow-2xl shadow-primary/30"
          >
            <span className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
              {cartCount}
            </span>
            <span className="font-bold">Ver Carrinho</span>
            <span className="font-black">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
