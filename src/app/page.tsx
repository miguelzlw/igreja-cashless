"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { getRoleDashboardPath } from "@/components/auth/AuthGuard";
import { FullPageLoading } from "@/components/shared/LoadingSpinner";

export default function Home() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Usar flag de proteção para evitar múltiplos redirecionamentos
    let redirecting = false;

    if (!user && !redirecting) {
      redirecting = true;
      router.replace("/login");
      return;
    }

    if (userDoc && !redirecting) {
      redirecting = true;
      router.replace(getRoleDashboardPath(userDoc.role));
    } else if (!userDoc && !loading && !redirecting) {
      redirecting = true;
      import("@/lib/firebase/auth").then(({ signOut }) => {
        signOut().then(() => router.replace("/login"));
      });
    }
  }, [user, userDoc, loading, router]);

  return <FullPageLoading text="Redirecionando..." />;
}
