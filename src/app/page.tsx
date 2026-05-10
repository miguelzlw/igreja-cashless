"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { getRoleDashboardPath } from "@/components/auth/AuthGuard";
import { FullPageLoading } from "@/components/shared/LoadingSpinner";

// Tempo de tolerância antes de desistir e deslogar quando temos um user
// autenticado mas sem userDoc no Firestore. Esse tempo cobre o cenário em que
// `consumeGoogleRedirect()` ainda está criando o doc do usuário em paralelo
// ao `onAuthStateChanged` que disparou imediatamente. Sem esse delay, novos
// usuários cadastrando via Google são deslogados antes do doc ser criado.
const USERDOC_GRACE_PERIOD_MS = 8000;

export default function Home() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;

    // 1) Sem usuário autenticado → vai pro login
    if (!user) {
      router.replace("/login");
      return;
    }

    // 2) Tem userDoc → redireciona pro dashboard do papel dele (cancela qualquer signOut pendente)
    if (userDoc) {
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current);
        signOutTimerRef.current = null;
      }
      router.replace(getRoleDashboardPath(userDoc.role));
      return;
    }

    // 3) Tem user mas userDoc ainda é null. Pode ser:
    //    - Cadastro Google em andamento (consumeGoogleRedirect criando o doc)
    //    - Doc realmente não existe (conta órfã, erro de permissão, etc.)
    //
    //    Esperamos um tempo de tolerância antes de desistir. O listener em
    //    tempo real do Firestore vai disparar o useEffect novamente assim que
    //    o doc for criado, e o caso (2) acima cancela esse timer.
    if (signOutTimerRef.current) return; // já tem timer rodando

    signOutTimerRef.current = setTimeout(() => {
      signOutTimerRef.current = null;
      import("@/lib/firebase/auth").then(({ signOut }) => {
        signOut().then(() => router.replace("/login"));
      });
    }, USERDOC_GRACE_PERIOD_MS);
  }, [user, userDoc, loading, router]);

  // Limpa o timer ao desmontar
  useEffect(() => {
    return () => {
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current);
      }
    };
  }, []);

  return <FullPageLoading text="Redirecionando..." />;
}
