"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, query, doc, updateDoc, getDocs, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Users, Loader2, CheckCircle2, ArrowLeft, Search, Shield } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";

export default function UsuariosPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <UsuariosContent />
    </AuthGuard>
  );
}

function UsuariosContent() {
  const { user, userDoc } = useAuth();

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

  // Stalls for select
  const [stalls, setStalls] = useState<{id: string, name: string}[]>([]);
  
  // Emails for autocomplete
  const [allEmails, setAllEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!user || userDoc?.role !== "admin") return;
    
    // Buscar barracas
    const q = query(collection(db, "stalls"));
    const unsub = onSnapshot(q, (snap) => {
      setStalls(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });
    
    // Buscar todos os e-mails para o autocomplete
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

      <section className="space-y-4">
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Buscar Usuário por E-mail
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
    </div>
  );
}
