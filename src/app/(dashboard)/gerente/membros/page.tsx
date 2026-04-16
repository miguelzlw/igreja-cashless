"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/config";
import {
  collection, onSnapshot, query, doc, updateDoc, getDocs, where
} from "firebase/firestore";
import { Users, Plus, X, Loader2, UserPlus, Search, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

export default function MembrosPage() {
  return (
    <AuthGuard allowedRoles={["gerente_barraca"]}>
      <MembrosContent />
    </AuthGuard>
  );
}

function MembrosContent() {
  const { user, userDoc } = useAuth();
  
  interface TeamMember { uid: string; name: string; email: string; role: string; }
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberSuccess, setMemberSuccess] = useState("");
  
  // Lista de e-mails para autocompletar
  const [allEmails, setAllEmails] = useState<string[]>([]);
  
  const stallId = userDoc?.stall_id;

  useEffect(() => {
    if (!stallId) return;

    // Buscar membros da equipe atual
    const qTeam = query(collection(db, "users"), where("stall_id", "==", stallId));
    const unsubTeam = onSnapshot(qTeam, (snap) => {
      setTeam(snap.docs.map(d => ({ uid: d.id, ...d.data() } as TeamMember)));
    });
    
    // Buscar todos os e-mails para o autocomplete (apenas contas livres/users)
    const fetchAllEmails = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "user"));
        const snap = await getDocs(q);
        setAllEmails(snap.docs.map(d => d.data().email).filter(Boolean));
      } catch (err) {
        console.error("Erro ao buscar e-mails para sugestão", err);
      }
    };
    fetchAllEmails();

    return () => unsubTeam();
  }, [stallId]);

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
      
      if (userData.role !== "user") {
        setMemberError("Este usuário já possui um cargo e não pode ser adicionado.");
        setMemberSearching(false);
        return;
      }

      const stallData = { name: "Barraca" };
      if (userDoc?.stall_name) {
         stallData.name = userDoc.stall_name;
      }

      await updateDoc(userRef, {
        stall_id: stallId,
        stall_name: stallData.name,
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

  if (!user || !userDoc || !stallId) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/gerente" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">
            Equipe da Barraca
          </h1>
        </div>
      </header>

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
                list="email-suggestions-gerente"
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMember()}
                placeholder="email@exemplo.com"
                className="input pl-9"
              />
              <datalist id="email-suggestions-gerente">
                {allEmails.map(email => (
                  <option key={email} value={email} />
                ))}
              </datalist>
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
    </div>
  );
}
