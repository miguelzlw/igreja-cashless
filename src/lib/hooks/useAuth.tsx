"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { subscribeToDocument } from "@/lib/firebase/firestore";
import type { AuthState, AuthUser, UserDoc, UserRole } from "@/lib/types";

interface AuthContextType extends AuthState {
  isRole: (role: UserRole | UserRole[]) => boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    userDoc: null,
    loading: true,
    error: null,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const refreshUser = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    // SSR guard — Firebase não está inicializado no servidor
    if (typeof window === "undefined") return;

    // Guard: se Firebase não está configurado (API key ausente), não tenta autenticar
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        user: null,
        userDoc: null,
        loading: false,
        error: "Firebase não configurado. Verifique o arquivo .env.local.",
      });
      return;
    }

    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpa listener anterior do Firestore
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!firebaseUser) {
        setState({
          user: null,
          userDoc: null,
          loading: false,
          error: null,
        });
        return;
      }

      const authUser = mapFirebaseUser(firebaseUser);
      setState((prev) => ({ ...prev, user: authUser, loading: true }));

      // Listener em tempo real no documento do usuário
      unsubscribeDoc = subscribeToDocument<UserDoc>(
        "users",
        firebaseUser.uid,
        (userDoc, error) => {
          setState({
            user: authUser,
            userDoc: userDoc,
            loading: false,
            error: error ? `Erro de Permissão (Atualize as Regras do Firebase): ${error.message}` : (userDoc ? null : "Perfil não encontrado. Faça login novamente para forçar a criação."),
          });
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [refreshKey]);

  const isRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!state.userDoc) return false;
      if (Array.isArray(role)) return role.includes(state.userDoc.role);
      return state.userDoc.role === role;
    },
    [state.userDoc]
  );

  return (
    <AuthContext.Provider value={{ ...state, isRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
