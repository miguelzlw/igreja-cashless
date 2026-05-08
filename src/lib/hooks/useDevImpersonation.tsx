"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";

const STORAGE_KEY = "dev:viewAsRole";

const IMPERSONABLE: ReadonlyArray<UserRole> = [
  "admin",
  "caixa",
  "gerente_barraca",
  "vendedor",
  "user",
];

function isImpersonableRole(value: unknown): value is UserRole {
  return typeof value === "string" && (IMPERSONABLE as ReadonlyArray<string>).includes(value);
}

interface DevImpersonationContextValue {
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  clear: () => void;
}

const DevImpersonationContext = createContext<DevImpersonationContextValue | undefined>(undefined);

export function DevImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [viewAsRole, setViewAsRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isImpersonableRole(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setViewAsRoleState(stored);
      }
    } catch {
      // localStorage indisponível — segue sem hidratar
    }
  }, []);

  const setViewAsRole = useCallback((role: UserRole | null) => {
    setViewAsRoleState(role);
    if (typeof window === "undefined") return;
    try {
      if (role) {
        window.localStorage.setItem(STORAGE_KEY, role);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignora falhas de storage
    }
  }, []);

  const clear = useCallback(() => setViewAsRole(null), [setViewAsRole]);

  return (
    <DevImpersonationContext.Provider value={{ viewAsRole, setViewAsRole, clear }}>
      {children}
    </DevImpersonationContext.Provider>
  );
}

export function useDevImpersonation(): DevImpersonationContextValue {
  const ctx = useContext(DevImpersonationContext);
  if (!ctx) {
    throw new Error("useDevImpersonation deve ser usado dentro de DevImpersonationProvider");
  }
  return ctx;
}

export const IMPERSONABLE_ROLES = IMPERSONABLE;
