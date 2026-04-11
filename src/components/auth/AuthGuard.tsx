"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type { UserRole } from "@/lib/types";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}

export default function AuthGuard({
  children,
  allowedRoles,
  fallbackPath = "/login",
}: AuthGuardProps) {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Não autenticado → login
    if (!user) {
      router.replace(fallbackPath);
      return;
    }

    // Autenticado mas sem doc (aguardando Cloud Function onUserCreate)
    if (!userDoc) return;

    // Role não permitida → redireciona para dashboard correto
    if (allowedRoles && !allowedRoles.includes(userDoc.role)) {
      const dashboardPath = getRoleDashboardPath(userDoc.role);
      router.replace(dashboardPath);
    }
  }, [user, userDoc, loading, allowedRoles, router, fallbackPath]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-[hsl(var(--text-secondary))] text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não autenticado
  if (!user) return null;

  // Aguardando doc
  if (!userDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-[hsl(var(--text-secondary))] text-sm">Configurando perfil...</p>
        </div>
      </div>
    );
  }

  // Role não permitida
  if (allowedRoles && !allowedRoles.includes(userDoc.role)) return null;

  return <>{children}</>;
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "caixa":
      return "/caixa";
    case "gerente_barraca":
      return "/gerente";
    case "vendedor":
      return "/vendedor";
    case "user":
    default:
      return "/user";
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin Geral";
    case "caixa":
      return "Caixa";
    case "gerente_barraca":
      return "Gerente de Barraca";
    case "vendedor":
      return "Vendedor";
    case "user":
      return "Participante";
    default:
      return "Desconhecido";
  }
}
