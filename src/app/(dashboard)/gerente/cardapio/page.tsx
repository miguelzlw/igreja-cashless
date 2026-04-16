"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  collection, onSnapshot, query, orderBy, doc, addDoc,
  updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import type { ProductDoc } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { Package, Plus, Minus, Trash2, Edit2, Check, X, Loader2, ToggleLeft, ToggleRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CardapioPage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <CardapioContent />
    </AuthGuard>
  );
}

function CardapioContent() {
  const { user, userDoc } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);

  // Modal Produto
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDoc | null>(null);
  const [productForm, setProductForm] = useState({ name: "", emoji: "", price: "", stock: "", unlimited: false });
  const [savingProduct, setSavingProduct] = useState(false);
  const [modalError, setModalError] = useState("");

  const stallId = userDoc?.stall_id;

  useEffect(() => {
    if (!stallId) return;

    const qProducts = query(collection(db, "stalls", stallId, "products"), orderBy("name", "asc"));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDoc)));
    });

    return () => unsubProducts();
  }, [stallId]);

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", emoji: "", price: "", stock: "0", unlimited: false });
    setModalError("");
    setShowProductModal(true);
  };

  const openEditProduct = (p: ProductDoc) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      emoji: p.emoji || "",
      price: (p.price_cents / 100).toFixed(2).replace(".", ","),
      stock: p.stock === -1 ? "0" : String(p.stock),
      unlimited: p.stock === -1,
    });
    setModalError("");
    setShowProductModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!stallId || !productForm.name.trim() || !productForm.price.trim()) {
      setModalError("Preencha o nome e o preço do produto.");
      return;
    }

    // Limpa caracteres indesejados caso o usuário tenha digitado "R$" ou espaços
    const cleanPrice = productForm.price.replace(/[^\d.,]/g, "").replace(",", ".");
    const price = parseFloat(cleanPrice) * 100;
    
    if (isNaN(price) || price <= 0) {
      setModalError("Preço inválido.");
      return;
    }

    const stock = productForm.unlimited ? -1 : parseInt(productForm.stock) || 0;

    setSavingProduct(true);
    try {
      const data = {
        stall_id: stallId,
        name: productForm.name.trim(),
        emoji: productForm.emoji.trim(),
        price_cents: Math.round(price),
        stock,
        active: editingProduct ? editingProduct.active : true,
        updated_at: serverTimestamp(),
      };

      if (editingProduct?.id) {
        await updateDoc(doc(db, "stalls", stallId, "products", editingProduct.id), data);
      } else {
        await addDoc(collection(db, "stalls", stallId, "products"), {
          ...data,
          created_at: serverTimestamp(),
        });
      }
      setShowProductModal(false);
    } catch (err) { 
      console.error(err); 
      setModalError("Erro ao salvar produto. Verifique as permissões.");
    } finally { 
      setSavingProduct(false); 
    }
  };

  const toggleProductActive = async (p: ProductDoc) => {
    if (!stallId || !p.id) return;
    await updateDoc(doc(db, "stalls", stallId, "products", p.id), { active: !p.active });
  };

  const deleteProduct = async (p: ProductDoc) => {
    if (!stallId || !p.id) return;
    if (!confirm(`Remover "${p.name}"?`)) return;
    await deleteDoc(doc(db, "stalls", stallId, "products", p.id));
  };

  const adjustStock = async (p: ProductDoc, delta: number) => {
    if (!stallId || !p.id || p.stock === -1) return;
    const newStock = Math.max(0, (p.stock || 0) + delta);
    await updateDoc(doc(db, "stalls", stallId, "products", p.id), { stock: newStock });
  };

  if (!user || !userDoc || !stallId) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/gerente" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">
            Cardápio
          </h1>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[hsl(var(--text-secondary))]">
            {products.length} produto(s) cadastrado(s)
          </p>
          <button onClick={openNewProduct} className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors font-medium">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>

        {products.length === 0 ? (
          <div className="glass-card p-8 text-center text-[hsl(var(--text-muted))]">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum produto ainda. Adicione o primeiro!</p>
          </div>
        ) : (
          products.map(p => (
            <div key={p.id} className={`glass-card p-4 ${!p.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {p.emoji && <span className="text-3xl shrink-0">{p.emoji}</span>}
                  <div className="min-w-0">
                    <p className={`font-bold truncate ${!p.active ? "line-through text-[hsl(var(--text-muted))]" : "text-[hsl(var(--text-primary))]"}`}>{p.name}</p>
                    <p className="text-primary font-semibold text-sm">{formatCurrency(p.price_cents)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleProductActive(p)} className={`p-1.5 rounded-lg ${p.active ? "text-emerald-500 hover:bg-emerald-500/10" : "text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg))]"}`}>
                    {p.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => deleteProduct(p)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Controle de estoque */}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/40">
                <span className="text-xs text-[hsl(var(--text-muted))] font-medium uppercase tracking-wide">Estoque</span>
                {p.stock === -1 ? (
                  <span className="text-xs text-emerald-500 font-medium">Ilimitado</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustStock(p, -1)} disabled={p.stock <= 0} className="w-7 h-7 rounded-full border border-[hsl(var(--border))] flex items-center justify-center hover:border-danger hover:text-danger disabled:opacity-40 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`w-8 text-center font-bold text-sm ${p.stock === 0 ? "text-danger" : p.stock <= 5 ? "text-warning" : "text-[hsl(var(--text-primary))]"}`}>{p.stock}</span>
                    <button onClick={() => adjustStock(p, 1)} className="w-7 h-7 rounded-full border border-[hsl(var(--border))] flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Modal Produto */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingProduct && setShowProductModal(false)} />
          <div className="relative w-full max-w-sm glass-card p-6 space-y-4 animate-slide-up shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h3>
              <button onClick={() => setShowProductModal(false)} disabled={savingProduct} className="p-1.5 rounded-full hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <p className="text-sm bg-danger/10 text-danger p-2 rounded-lg">{modalError}</p>
            )}

            <form onSubmit={saveProduct} className="space-y-4">
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="block text-xs font-medium text-[hsl(var(--text-secondary))] mb-1">Emoji</label>
                  <input
                    type="text"
                    value={productForm.emoji}
                    onChange={e => setProductForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🍺"
                    className="input text-center text-2xl h-12"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[hsl(var(--text-secondary))] mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Chopp 500ml"
                    className="input"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[hsl(var(--text-secondary))] mb-1">Preço (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] font-medium text-sm">R$</span>
                  <input
                    type="text"
                    value={productForm.price}
                    onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="10,00"
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[hsl(var(--text-secondary))]">Estoque Inicial</label>
                  <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-secondary))] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.unlimited}
                      onChange={e => setProductForm(f => ({ ...f, unlimited: e.target.checked }))}
                      className="rounded"
                    />
                    Estoque ilimitado
                  </label>
                </div>
                {!productForm.unlimited && (
                  <input
                    type="number"
                    min="0"
                    value={productForm.stock}
                    onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="0"
                    className="input"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={savingProduct || !productForm.name.trim() || !productForm.price.trim()}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
