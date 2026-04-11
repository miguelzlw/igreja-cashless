"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  collection, onSnapshot, addDoc, serverTimestamp,
  query, orderBy, doc, updateDoc, getDocs, where
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  Building2, Activity, Store, Plus, Loader2, X,
  CheckCircle2, Users, Search, Shield, ShieldOff
} from "lucide-react";

interface LocalStall {
  id: string;
  name: string;
  total_sales_cents: number;
  is_active: boolean;
}

type AdminTab = "barracas" | "usuarios";

export default function AdminDashboard() {
  const { user, userDoc } = useAuth();
  const [tab, setTab] = useState<AdminTab>("barracas");
  const [stalls, setStalls] = useState<LocalStall[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Nova Barraca
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStallName, setNewStallName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorStr, setErrorStr] = useState("");
  const [successStr, setSuccessStr] = useState("");

  // Gerenciar Usuários
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  interface FoundUser { uid: string; name: string; email: string; role: string; stall_id?: string; }
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStall, setSelectedStall] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState("");

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

  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStallName.trim()) return;
    setIsCreating(true);
    setErrorStr("");
    setSuccessStr("");
    try {
      await addDoc(collection(db, "stalls"), {
        name: newStallName.trim(),
        owner_uid: "system",
        created_by: user!.uid,
        is_active: true,
        total_sales_cents: 0,
        created_at: serverTimestamp(),
      });
      setSuccessStr("Barraca criada com sucesso!");
      setNewStallName("");
      setTimeout(() => { setIsModalOpen(false); setSuccessStr(""); }, 1500);
    } catch (err) {
      console.error(err);
      setErrorStr("Erro ao criar a barraca.");
    } finally {
      setIsCreating(false);
    }
  };

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchError("");
    setRoleSaveSuccess("");
    setSelectedRole("");
    setSelectedStall("");
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError("Nenhum usuário encontrado com este e-mail.");
        return;
      }
      const d = snap.docs[0];
      const userData = d.data();
      setFoundUser({ uid: d.id, ...userData } as FoundUser);
      setSelectedRole(userData.role || "user");
      setSelectedStall(userData.stall_id || "");
    } catch (err) {
      console.error(err);
      setSearchError("Erro ao buscar usuário.");
    } finally {
      setSearching(false);
    }
  };

  const saveUserRole = async () => {
    if (!foundUser || !selectedRole) return;
    setSavingRole(true);
    setRoleSaveSuccess("");
    try {
      const needsStall = ["vendedor", "gerente_barraca"].includes(selectedRole);
      const stallName = stalls.find(s => s.id === selectedStall)?.name || "";
      await updateDoc(doc(db, "users", foundUser.uid), {
        role: selectedRole,
        stall_id: needsStall && selectedStall ? selectedStall : null,
        stall_name: needsStall && selectedStall ? stallName : null,
      });
      setRoleSaveSuccess(`Cargo de ${foundUser.name} atualizado para "${selectedRole}"!`);
      setFoundUser(prev => prev ? { ...prev, role: selectedRole, stall_id: selectedStall } : null);
    } catch (err) {
      console.error(err);
      setSearchError("Erro ao salvar cargo.");
    } finally {
      setSavingRole(false);
    }
  };

  if (!user || userDoc?.role !== "admin") return null;

  const eventTotalCents = stalls.reduce((sum, s) => sum + s.total_sales_cents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Administração Geral</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Controle completo do evento</p>
        </div>
      </header>

      {/* Resumo Global */}
      <div className="glass-card overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity className="w-32 h-32" />
        </div>
        <div className="relative z-10 p-6">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Faturamento Global</p>
          <h2 className="text-5xl font-black tracking-tight text-emerald-500">{formatCurrency(eventTotalCents)}</h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-3">
            {stalls.length} barraca{stalls.length !== 1 && "s"} ativas
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-[hsl(var(--card))] p-1 rounded-xl border border-[hsl(var(--border))]/50">
        <button
          onClick={() => setTab("barracas")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "barracas" ? "bg-primary text-white shadow" : "text-[hsl(var(--text-secondary))]"}`}
        >
          <Store className="w-4 h-4" /> Barracas
        </button>
        <button
          onClick={() => setTab("usuarios")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "usuarios" ? "bg-primary text-white shadow" : "text-[hsl(var(--text-secondary))]"}`}
        >
          <Users className="w-4 h-4" /> Usuários
        </button>
      </div>

      {/* ── ABA BARRACAS ──────────────────────────────────── */}
      {tab === "barracas" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" /> Barracas Cadastradas
            </h3>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors font-medium">
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
                  <p className="font-bold text-emerald-500 text-lg">{formatCurrency(stall.total_sales_cents)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── ABA USUÁRIOS ─────────────────────────────────── */}
      {tab === "usuarios" && (
        <section className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Buscar Usuário por E-mail
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchUser()}
                placeholder="usuario@email.com"
                className="input flex-1"
              />
              <button onClick={searchUser} disabled={searching || !searchEmail.trim()} className="btn-primary px-4 flex items-center gap-1 shrink-0">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {searchError && <p className="text-sm text-danger bg-danger/10 p-2 rounded-lg">{searchError}</p>}
          </div>

          {foundUser && (
            <div className="glass-card p-5 space-y-4 border border-primary/20">
              {/* Info do usuário */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {foundUser.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-bold text-[hsl(var(--text-primary))]">{foundUser.name}</p>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">{foundUser.email}</p>
                  <span className="text-xs bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full font-medium capitalize mt-0.5 inline-block">
                    {foundUser.role}
                  </span>
                </div>
              </div>

              {/* Mudar cargo */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Novo Cargo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["user", "caixa", "vendedor", "gerente_barraca", "admin"] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all capitalize ${
                        selectedRole === role
                          ? "bg-primary text-white border-primary"
                          : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:border-primary/50"
                      }`}
                    >
                      {role === "gerente_barraca" ? "Gerente" : role === "user" ? "Usuário" : role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vincular barraca (se necessário) */}
              {(selectedRole === "vendedor" || selectedRole === "gerente_barraca") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">
                    Vincular à Barraca <span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedStall}
                    onChange={e => setSelectedStall(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione uma barraca...</option>
                    {stalls.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {roleSaveSuccess && (
                <p className="text-sm text-emerald-500 bg-emerald-500/10 p-2 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />{roleSaveSuccess}
                </p>
              )}

              <button
                onClick={saveUserRole}
                disabled={savingRole || !selectedRole || ((selectedRole === "vendedor" || selectedRole === "gerente_barraca") && !selectedStall)}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Salvar Cargo
              </button>
            </div>
          )}
        </section>
      )}

      {/* Modal Nova Barraca */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreating && setIsModalOpen(false)} />
          <div className="relative w-full max-w-sm glass-card border flex flex-col p-6 animate-slide-up shadow-2xl rounded-2xl">
            <button onClick={() => setIsModalOpen(false)} disabled={isCreating} className="absolute top-4 right-4 p-2 rounded-full hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-4">Nova Barraca</h3>

            {errorStr && <p className="p-3 mb-4 bg-danger/10 text-danger text-sm rounded-lg">{errorStr}</p>}
            {successStr && (
              <p className="p-3 mb-4 bg-emerald-500/10 text-emerald-500 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {successStr}
              </p>
            )}

            <form onSubmit={handleCreateStall} className="space-y-4">
              <div>
                <label className="block text-sm text-[hsl(var(--text-secondary))] mb-1 font-medium">Nome da Barraca</label>
                <input
                  type="text"
                  autoFocus
                  required
                  disabled={isCreating}
                  value={newStallName}
                  onChange={e => setNewStallName(e.target.value)}
                  placeholder="Ex: Chopp e Bebidas"
                  className="input"
                />
              </div>
              <button type="submit" disabled={isCreating || !newStallName.trim()} className="btn-primary w-full flex justify-center py-3">
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar Barraca"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
