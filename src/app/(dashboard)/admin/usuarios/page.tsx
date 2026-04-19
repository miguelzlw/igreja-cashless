"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, query, doc, updateDoc, getDocs, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Users, Loader2, CheckCircle2, ArrowLeft, Search, Shield, X } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";

export default function UsuariosPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <UsuariosContent />
    </AuthGuard>
  );
}

const ROLE_FILTERS = [
  { key: "user", label: "Usuários", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { key: "caixa", label: "Caixas", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  { key: "vendedor", label: "Vendedores", color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  { key: "gerente_barraca", label: "Gerentes", color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
];

interface UserData {
  uid: string;
  name: string;
  email: string;
  role: string;
  stall_id?: string;
  stall_name?: string;
}

function UsuariosContent() {
  const { user, userDoc } = useAuth();

  // Busca por e-mail
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserData | null>(null);
  const [searchError, setSearchError] = useState("");

  // Filtro por role
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loadingFilter, setLoadingFilter] = useState(false);

  // Edição de cargo (compartilhado)
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStall, setSelectedStall] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState("");

  // Stalls for select
  const [stalls, setStalls] = useState<{id: string, name: string}[]>([]);

  // Emails for autocomplete
  const [allEmails, setAllEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!user || userDoc?.role !== "admin") return;

    const q = query(collection(db, "stalls"));
    const unsub = onSnapshot(q, (snap) => {
      setStalls(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });

    const fetchAllEmails = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        setAllEmails(snap.docs.map(d => d.data().email).filter(Boolean));
      } catch (err) {
        console.error("Erro ao buscar e-mails para sugestão", err);
      }
    };
    fetchAllEmails();

    return () => unsub();
  }, [user, userDoc]);

  // Busca por e-mail
  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchError("");
    setRoleSaveSuccess("");
    setEditingUser(null);
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError("Nenhum usuário encontrado com este e-mail.");
        return;
      }
      const d = snap.docs[0];
      const userData = { uid: d.id, ...d.data() } as UserData;
      setFoundUser(userData);
      openEditor(userData);
    } catch (err) {
      console.error(err);
      setSearchError("Erro ao buscar usuário.");
    } finally {
      setSearching(false);
    }
  };

  // Filtrar por role
  const filterByRole = async (role: string) => {
    if (activeFilter === role) {
      setActiveFilter(null);
      setFilteredUsers([]);
      return;
    }
    setActiveFilter(role);
    setLoadingFilter(true);
    setEditingUser(null);
    setRoleSaveSuccess("");
    try {
      const q = query(collection(db, "users"), where("role", "==", role));
      const snap = await getDocs(q);
      setFilteredUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserData)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFilter(false);
    }
  };

  // Abrir editor de cargo
  const openEditor = (u: UserData) => {
    setEditingUser(u);
    setSelectedRole(u.role || "user");
    setSelectedStall(u.stall_id || "");
    setRoleSaveSuccess("");
  };

  // Salvar cargo
  const saveUserRole = async () => {
    if (!editingUser || !selectedRole) return;
    setSavingRole(true);
    setRoleSaveSuccess("");
    try {
      const needsStall = ["vendedor", "gerente_barraca"].includes(selectedRole);
      const stallName = stalls.find(s => s.id === selectedStall)?.name || "";
      await updateDoc(doc(db, "users", editingUser.uid), {
        role: selectedRole,
        stall_id: needsStall && selectedStall ? selectedStall : null,
        stall_name: needsStall && selectedStall ? stallName : null,
      });
      setRoleSaveSuccess(`Cargo de ${editingUser.name} atualizado para "${selectedRole}"!`);

      // Atualizar nas listas locais
      const updated = { ...editingUser, role: selectedRole, stall_id: selectedStall };
      setEditingUser(updated);
      if (foundUser?.uid === editingUser.uid) setFoundUser(updated);
      // Se a role mudou e o filtro está ativo, remover da lista filtrada
      if (activeFilter && selectedRole !== activeFilter) {
        setFilteredUsers(prev => prev.filter(u => u.uid !== editingUser.uid));
      } else {
        setFilteredUsers(prev => prev.map(u => u.uid === editingUser.uid ? updated : u));
      }
    } catch (err) {
      console.error(err);
      setSearchError("Erro ao salvar cargo.");
    } finally {
      setSavingRole(false);
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
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Gestão de Usuários</h1>
        </div>
      </header>

      {/* Busca por e-mail */}
      <section className="space-y-4">
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Buscar por E-mail
          </h3>
          <div className="flex gap-2">
            <input
              type="email"
              list="email-suggestions-admin"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchUser()}
              placeholder="usuario@email.com"
              className="input flex-1"
            />
            <datalist id="email-suggestions-admin">
              {allEmails.map(email => (
                <option key={email} value={email} />
              ))}
            </datalist>
            <button onClick={searchUser} disabled={searching || !searchEmail.trim()} className="btn-primary px-4 flex items-center gap-1 shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {searchError && <p className="text-sm text-danger bg-danger/10 p-2 rounded-lg">{searchError}</p>}
        </div>
      </section>

      {/* Filtros por função */}
      <section className="space-y-3">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] text-sm">Filtrar por Função</h3>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_FILTERS.map(rf => (
            <button
              key={rf.key}
              onClick={() => filterByRole(rf.key)}
              className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                activeFilter === rf.key
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : `${rf.color} border hover:scale-[1.02]`
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </section>

      {/* Lista de usuários filtrados */}
      {activeFilter && (
        <section className="space-y-2 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[hsl(var(--text-primary))] text-sm">
              {ROLE_FILTERS.find(r => r.key === activeFilter)?.label} ({filteredUsers.length})
            </h3>
            <button onClick={() => { setActiveFilter(null); setFilteredUsers([]); setEditingUser(null); }} className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]">
              Limpar
            </button>
          </div>

          {loadingFilter ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))] text-sm">
              Nenhum usuário com esta função.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => openEditor(u)}
                  className={`w-full text-left glass-card p-3 flex items-center gap-3 transition-all hover:border-primary/40 ${
                    editingUser?.uid === u.uid ? "border-primary ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {u.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[hsl(var(--text-primary))] text-sm truncate">{u.name}</p>
                    <p className="text-xs text-[hsl(var(--text-muted))] truncate">{u.email}</p>
                  </div>
                  {u.stall_name && (
                    <span className="text-[10px] bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full text-[hsl(var(--text-muted))] shrink-0">
                      {u.stall_name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Editor de cargo */}
      {editingUser && (
        <section className="glass-card p-5 space-y-4 border border-primary/20 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {editingUser.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-bold text-[hsl(var(--text-primary))]">{editingUser.name}</p>
                <p className="text-sm text-[hsl(var(--text-secondary))]">{editingUser.email}</p>
                <span className="text-xs bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full font-medium capitalize mt-0.5 inline-block">
                  {editingUser.role === "gerente_barraca" ? "Gerente" : editingUser.role}
                </span>
              </div>
            </div>
            <button onClick={() => { setEditingUser(null); setRoleSaveSuccess(""); }} className="p-1.5 rounded-full hover:bg-[hsl(var(--bg))]">
              <X className="w-4 h-4 text-[hsl(var(--text-muted))]" />
            </button>
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

          {/* Vincular barraca */}
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
        </section>
      )}
    </div>
  );
}
