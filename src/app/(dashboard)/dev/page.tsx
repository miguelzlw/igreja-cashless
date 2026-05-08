"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Code2, ShieldCheck, Wallet, Store, ShoppingCart, User, ArrowRight, Users } from "lucide-react";
import AuthGuard, { getRoleDashboardPath } from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { useDevImpersonation } from "@/lib/hooks/useDevImpersonation";
import type { UserRole } from "@/lib/types";

export default function DevHubPage() {
  return (
    <AuthGuard allowedRoles={["desenvolvedor"]}>
      <DevHubContent />
    </AuthGuard>
  );
}

interface DevCard {
  role: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const CARDS: DevCard[] = [
  {
    role: "admin",
    title: "Admin Geral",
    description: "Dashboard, barracas e gestão de usuários.",
    icon: <ShieldCheck className="w-5 h-5" />,
    accent: "bg-primary/10 text-primary border-primary/30",
  },
  {
    role: "caixa",
    title: "Caixa",
    description: "Recargas, fichas físicas e leitura de QR.",
    icon: <Wallet className="w-5 h-5" />,
    accent: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  {
    role: "gerente_barraca",
    title: "Gerente de Barraca",
    description: "Cardápio, membros e relatório da barraca.",
    icon: <Store className="w-5 h-5" />,
    accent: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  },
  {
    role: "vendedor",
    title: "Vendedor (PDV)",
    description: "Ponto de venda da barraca vinculada.",
    icon: <ShoppingCart className="w-5 h-5" />,
    accent: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  {
    role: "user",
    title: "Cliente",
    description: "Saldo, QR Code e histórico do participante.",
    icon: <User className="w-5 h-5" />,
    accent: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  },
];

function DevHubContent() {
  const { userDoc } = useAuth();
  const { setViewAsRole } = useDevImpersonation();
  const router = useRouter();

  if (!userDoc) return null;

  const enter = (role: UserRole) => {
    setViewAsRole(role);
    router.push(getRoleDashboardPath(role));
  };

  const needsStallNote = !userDoc.stall_id;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 bg-fuchsia-500/10 text-fuchsia-500 rounded-xl flex items-center justify-center shrink-0 border border-fuchsia-500/30">
          <Code2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Hub do Desenvolvedor</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">
            Entre em qualquer painel como se fosse aquele papel — sua role real continua sendo desenvolvedor.
          </p>
        </div>
      </header>

      {needsStallNote && (
        <div className="glass-card p-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <Users className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-[hsl(var(--text-primary))]">
              Para testar Vendedor e Gerente, vincule sua conta a uma barraca.
            </p>
            <p className="text-[hsl(var(--text-secondary))]">
              Em <Link href="/admin/usuarios" className="underline text-primary">Gestão de Usuários</Link> busque seu próprio e-mail e selecione uma barraca (mantenha a role como Desenvolvedor).
            </p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <button
            key={card.role}
            onClick={() => enter(card.role)}
            className="glass-card p-4 text-left flex flex-col gap-2 hover:border-primary/40 hover:scale-[1.01] transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${card.accent}`}>
                {card.icon}
              </div>
              <h3 className="font-semibold text-[hsl(var(--text-primary))]">{card.title}</h3>
            </div>
            <p className="text-xs text-[hsl(var(--text-secondary))]">{card.description}</p>
            <div className="flex items-center justify-end gap-1 text-xs text-primary mt-1 group-hover:gap-2 transition-all">
              Acessar painel <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        ))}
      </section>

      <section className="glass-card p-4 text-xs text-[hsl(var(--text-muted))] space-y-1">
        <p>
          <strong className="text-[hsl(var(--text-secondary))]">Como funciona:</strong> ao escolher um painel, salvamos sua escolha em <code>localStorage</code> e a navbar passa a mostrar os atalhos daquele papel.
        </p>
        <p>
          Use o seletor &ldquo;Visualizando como&rdquo; no topo para trocar de painel a qualquer momento, ou volte aqui pelo Hub Dev.
        </p>
      </section>
    </div>
  );
}
