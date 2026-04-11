"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  collection, onSnapshot, query, orderBy, doc, addDoc,
  updateDoc, deleteDoc, serverTimestamp, getDocs, where, getDoc
} from "firebase/firestore";
import type { ProductDoc, StallDoc } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  Store, Activity, AlertTriangle, Package, Users,
  Plus, Minus, Trash2, Edit2, Check, X, Loader2,
  BarChart2, UserPlus, Search, ToggleLeft, ToggleRight
} from "lucide-react";

type Tab = "resumo" | "produtos" | "equipe";

export default function GerenteDashboard() {
  const { user, userDoc } = useAuth();
  const [tab, setTab] = useState<Tab>("resumo");
  const [stallData, setStallData] = useState<StallDoc | null>(null);
  const [stallError, setStallError] = useState("");

  // Produtos
  const [products, setProducts] = useState<ProductDoc[]>([]);

  // Equipe
  interface TeamMember { uid: string; name: string; email: string; role: string; }
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberSuccess, setMemberSuccess] = useState("");

  // Modal Produto
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDoc | null>(null);
  const [productForm, setProductForm] = useState({ name: "", emoji: "", price: "", stock: "", unlimited: false });
  const [savingProduct, setSavingProduct] = useState(false);

  const stallId = userDoc?.stall_id;

  // ── Listeners em tempo real ──────────────────────────────
  useEffect(() => {
    if (!stallId) return;

    const stallRef = doc(db, "stalls", stallId);
    const unsubStall = onSnapshot(stallRef, (snap) => {
      if (snap.exists()) setStallData(snap.data() as StallDoc);
      else setStallError("Barraca não encontrada.");
    }, (err) => { console.error(err); setStallError("Erro de permissão."); });

    const qProducts = query(collection(db, "stalls", stallId, "products"), orderBy("name", "asc"));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDoc)));
    });

    const qTeam = query(collection(db, "users"), where("stall_id", "==", stallId));
    const unsubTeam = onSnapshot(qTeam, (snap) => {
      setTeam(snap.docs.map(d => ({ uid: d.id, ...d.data() } as TeamMember)));
    });

    return () => { unsubStall(); unsubProducts(); unsubTeam(); };
  }, [stallId]);

  // ── Gerenciar Produtos ───────────────────────────────────

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", emoji: "", price: "", stock: "0", unlimited: false });
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
    setShowProductModal(true);
  };

  const saveProduct = async () => {
    if (!stallId || !productForm.name.trim()) return;
    const price = parseFloat(productForm.price.replace(",", ".")) * 100;
    if (isNaN(price) || price <= 0) return;
    const stock = productForm.unlimited ? -1 : parseInt(productForm.stock) || 0;

    setSavingProduct(true);
    try {
      const data = {
        stall_id: stallId,
        name: productForm.name.trim(),
        emoji: productForm.emoji.trim(),
        price_cents: Math.round(price),
        stock,
        active: true,
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
    } catch (err) { console.error(err); }
    finally { setSavingProduct(false); }
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

  // ── Gerenciar Equipe ─────────────────────────────────────

  const addMember = async () => {
    if (!stallId || !memberEmail.trim()) return;
    setMemberSearching(true);
    setMemberError("");
    setMemberSuccess("");

    try {
      const q = query(collection(db, "users"), where("email", "==", memberEmail.trim().toLowerCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setMemberError("Usuário não encontrado. O e-mail precisa ser de alguém já cadastrado no sistema.");
        return;
      }

      const userRef = snap.docs[0].ref;
      const userData = snap.docs[0].data();
      await updateDoc(userRef, {
        stall_id: stallId,
        stall_name: stallData?.name || "",
        role: "vendedor",
      });
      setMemberSuccess(`${userData.name} adicionado(a) como Vendedor(a)!`);
      setMemberEmail("");
    } catch (err) {
      console.error(err);
      setMemberError("Erro ao adicionar membro.");
    } finally {
      setMemberSearching(false);
    }
  };

  const removeMember = async (memberUid: string, memberName: string) => {
    if (!confirm(`Remover ${memberName} da barraca?`)) return;
    await updateDoc(doc(db, "users", memberUid), {
      stall_id: null,
      stall_name: null,
      role: "user",
    });
  };

  // ── Guards ───────────────────────────────────────────────

  if (!user || !userDoc) return null;

  if (!stallId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-warning/10 text-warning flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">Sem Barraca Atribuída</h2>
        <p className="text-[hsl(var(--text-secondary))]">Peça ao Admin para te vincular a uma barraca.</p>
      </div>
    );
  }

  if (stallError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center text-danger">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{stallError}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
            {stallData?.name || "Carregando..."}
          </h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Gerência da Barraca</p>
        </div>
      </header>

      {/* Abas */}
      <div className="flex gap-1 bg-[hsl(var(--card))] p-1 rounded-xl border border-[hsl(var(--border))]/50">
        {([
          { key: "resumo", label: "Resumo", Icon: BarChart2 },
          { key: "produtos", label: "Produtos", Icon: Package },
          { key: "equipe", label: "Equipe", Icon: Users },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? "bg-primary text-white shadow"
                : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── ABA RESUMO ──────────────────────────────────── */}
      {tab === "resumo" && (
        <section className="space-y-4">
          <div className="glass-card overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-24 h-24" />
            </div>
            <div className="relative z-10 p-6">
              <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Apurado Agora</p>
              <h2 className="text-5xl font-black tracking-tight text-emerald-500">
                {formatCurrency(stallData?.total_sales_cents || 0)}
              </h2>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-2">
                {products.filter(p => p.active).length} produto(s) • {team.length} membro(s)
              </p>
            </div>
          </div>

          <div className="glass-card p-4 space-y-2">
            <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-3">Produtos mais vendidos (em breve)</p>
            <p className="text-xs text-[hsl(var(--text-muted))] text-center py-4">Relatório por produto disponível após o evento</p>
          </div>
        </section>
      )}

      {/* ── ABA PRODUTOS ─────────────────────────────────── */}
      {tab === "produtos" && (
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
      )}

      {/* ── ABA EQUIPE ───────────────────────────────────── */}
      {tab === "equipe" && (
        <section className="space-y-4">
          {/* Adicionar membro */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Adicionar Vendedor
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-muted))]" />
                <input
                  type="email"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMember()}
                  placeholder="email@exemplo.com"
                  className="input pl-9"
                />
              </div>
              <button onClick={addMember} disabled={memberSearching || !memberEmail.trim()} className="btn-primary px-4 flex items-center gap-1 shrink-0">
                {memberSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {memberError && <p className="text-sm text-danger bg-danger/10 p-2 rounded-lg">{memberError}</p>}
            {memberSuccess && <p className="text-sm text-emerald-500 bg-emerald-500/10 p-2 rounded-lg flex items-center gap-2"><Check className="w-4 h-4" />{memberSuccess}</p>}
          </div>

          {/* Lista da equipe */}
          {team.length === 0 ? (
            <div className="glass-card p-8 text-center text-[hsl(var(--text-muted))]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum membro ainda.</p>
            </div>
          ) : (
            team.map(member => (
              <div key={member.uid} className="glass-card p-4 flex items-center justify-between gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[hsl(var(--text-primary))] truncate">{member.name}</p>
                  <p className="text-xs text-[hsl(var(--text-secondary))] truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                    {member.role === "vendedor" ? "Vendedor" : member.role}
                  </span>
                  {member.uid !== user?.uid && (
                    <button onClick={() => removeMember(member.uid, member.name)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ── MODAL PRODUTO ──────────────────────────────── */}
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
              onClick={saveProduct}
              disabled={savingProduct || !productForm.name.trim() || !productForm.price}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
