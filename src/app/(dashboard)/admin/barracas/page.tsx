"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  collection, onSnapshot, addDoc, serverTimestamp,
  query, orderBy, doc, updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import { Store, Plus, Loader2, X, CheckCircle2, ArrowLeft, Edit2 } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";

interface LocalStall {
  id: string;
  name: string;
  total_sales_cents: number;
  is_active: boolean;
}

export default function BarracasPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <BarracasContent />
    </AuthGuard>
  );
}

function BarracasContent() {
  const { user, userDoc } = useAuth();
  const [stalls, setStalls] = useState<LocalStall[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Barraca
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStall, setEditingStall] = useState<LocalStall | null>(null);
  const [stallName, setStallName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorStr, setErrorStr] = useState("");
  const [successStr, setSuccessStr] = useState("");

  useEffect(() => {
    if (!user || userDoc?.role !== "admin") return;
    const q = query(collection(db, "stalls"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const parsed: LocalStall[] = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || "Sem Nome",
        total_sales_cents: d.data().total_sales_cents || 0,
        is_active: d.data().is_active ?? true,
      }));
      setStalls(parsed);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user, userDoc]);

  const openNewStall = () => {
    setEditingStall(null);
    setStallName("");
    setIsModalOpen(true);
    setErrorStr("");
    setSuccessStr("");
  };

  const openEditStall = (stall: LocalStall) => {
    setEditingStall(stall);
    setStallName(stall.name);
    setIsModalOpen(true);
    setErrorStr("");
    setSuccessStr("");
  };

  const handleSaveStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stallName.trim()) return;
    setIsSaving(true);
    setErrorStr("");
    setSuccessStr("");
    try {
      if (editingStall) {
        await updateDoc(doc(db, "stalls", editingStall.id), {
          name: stallName.trim()
        });
        setSuccessStr("Barraca atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "stalls"), {
          name: stallName.trim(),
          owner_uid: "system",
          created_by: user!.uid,
          is_active: true,
          total_sales_cents: 0,
          created_at: serverTimestamp(),
        });
        setSuccessStr("Barraca criada com sucesso!");
      }
      setTimeout(() => { setIsModalOpen(false); setSuccessStr(""); }, 1500);
    } catch (err) {
      console.error(err);
      setErrorStr(editingStall ? "Erro ao atualizar a barraca." : "Erro ao criar a barraca.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || userDoc?.role !== "admin") return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Barracas</h1>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[hsl(var(--text-secondary))]">
            {stalls.length} barraca(s) cadastrada(s)
          </p>
          <button onClick={openNewStall} className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors font-medium">
            <Plus className="w-4 h-4" /> Nova Barraca
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-8 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : stalls.length === 0 ? (
          <div className="glass-card p-8 text-center text-[hsl(var(--text-muted))]">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma barraca cadastrada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {stalls.map(stall => (
              <div key={stall.id} className="glass-card p-4 flex items-center justify-between hover:bg-[hsl(var(--card))]/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${stall.is_active ? "bg-emerald-500" : "bg-danger"}`} />
                  <div>
                    <p className="font-bold text-[hsl(var(--text-primary))]">{stall.name}</p>
                    <p className="text-xs text-[hsl(var(--text-muted))] font-mono mt-0.5">ID: {stall.id.substring(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-emerald-500 text-lg">{formatCurrency(stall.total_sales_cents)}</p>
                  <button onClick={() => openEditStall(stall)} className="p-2 rounded-lg hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Barraca */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
          <div className="relative w-full max-w-sm glass-card border flex flex-col p-6 animate-slide-up shadow-2xl rounded-2xl">
            <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="absolute top-4 right-4 p-2 rounded-full hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-4">
              {editingStall ? "Editar Barraca" : "Nova Barraca"}
            </h3>

            {errorStr && <p className="p-3 mb-4 bg-danger/10 text-danger text-sm rounded-lg">{errorStr}</p>}
            {successStr && (
              <p className="p-3 mb-4 bg-emerald-500/10 text-emerald-500 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {successStr}
              </p>
            )}

            <form onSubmit={handleSaveStall} className="space-y-4">
              <div>
                <label className="block text-sm text-[hsl(var(--text-secondary))] mb-1 font-medium">Nome da Barraca</label>
                <input
                  type="text"
                  autoFocus
                  required
                  disabled={isSaving}
                  value={stallName}
                  onChange={e => setStallName(e.target.value)}
                  placeholder="Ex: Chopp e Bebidas"
                  className="input"
                />
              </div>
              <button type="submit" disabled={isSaving || !stallName.trim()} className="btn-primary w-full flex justify-center py-3">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
