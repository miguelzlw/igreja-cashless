"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import TransactionHistory from "@/components/user/TransactionHistory";

export default function ExtratoPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/user" className="p-2 rounded-full hover:bg-[hsl(var(--card))] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Extrato</h1>
          <p className="text-[hsl(var(--text-secondary))] text-sm">Todas as suas transações</p>
        </div>
      </header>

      <TransactionHistory userId={user.uid} />
    </div>
  );
}
