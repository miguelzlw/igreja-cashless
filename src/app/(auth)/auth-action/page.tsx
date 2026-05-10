"use client";

import { useEffect, useState, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Loader2, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

/**
 * Página única que trata os action handlers de Firebase Auth:
 * - mode=resetPassword → tela de criar nova senha
 * - mode=verifyEmail   → confirma e-mail
 * - mode=recoverEmail  → reverte mudança de e-mail
 *
 * Para usar, configure no Firebase Console:
 *   Authentication → Templates → Editar template → Personalizar URL de ação
 *   → https://SEU_DOMINIO/auth-action
 */
export default function AuthActionPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AuthActionContent />
    </Suspense>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function AuthActionContent() {
  const params = useSearchParams();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode") || "";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--bg))] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary-300/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary-400 to-primary-300 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-primary/30 mb-4">
            SJ
          </div>
        </div>

        <div className="glass-card p-8">
          {mode === "resetPassword" ? (
            <ResetPasswordForm oobCode={oobCode} />
          ) : mode === "verifyEmail" ? (
            <VerifyEmailFlow oobCode={oobCode} />
          ) : (
            <UnknownActionMessage />
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Fluxo: redefinição de senha
// ──────────────────────────────────────────────────────────────────────
function ResetPasswordForm({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"verifying" | "ready" | "saving" | "done" | "error">("verifying");
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Valida o código no carregamento
  useEffect(() => {
    if (!oobCode) {
      setError("Link inválido. Solicite uma nova redefinição.");
      setPhase("error");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((emailFromCode) => {
        setEmail(emailFromCode);
        setPhase("ready");
      })
      .catch(() => {
        setError("Este link expirou ou já foi usado. Solicite uma nova redefinição na tela de login.");
        setPhase("error");
      });
  }, [oobCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setPhase("saving");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPhase("done");
      setTimeout(() => router.replace("/login"), 2500);
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
      setPhase("error");
    }
  };

  if (phase === "verifying") {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-[hsl(var(--text-secondary))]">Validando seu link...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-danger/10 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Link inválido</h2>
        <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
        <Link href="/login" className="btn-primary w-full">Voltar ao login</Link>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-emerald-500">Senha atualizada!</h2>
        <p className="text-sm text-[hsl(var(--text-secondary))]">Você já pode entrar com a nova senha. Redirecionando...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-3">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))]">Nova senha</h2>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
          para <strong>{email}</strong>
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm text-center">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Nova senha</label>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          required
          autoFocus
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Confirmar senha</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
          placeholder="Repita a senha"
          minLength={6}
          required
          autoComplete="new-password"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="w-4 h-4"
        />
        Mostrar senhas
      </label>

      <button type="submit" disabled={phase === "saving"} className="btn-primary w-full">
        {phase === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Atualizar senha"}
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Fluxo: confirmação de e-mail (caso ative no futuro)
// ──────────────────────────────────────────────────────────────────────
function VerifyEmailFlow({ oobCode }: { oobCode: string }) {
  const [phase, setPhase] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!oobCode) {
      setError("Link inválido.");
      setPhase("error");
      return;
    }
    applyActionCode(auth, oobCode)
      .then(() => setPhase("done"))
      .catch(() => {
        setError("Este link expirou ou já foi usado.");
        setPhase("error");
      });
  }, [oobCode]);

  if (phase === "working") {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-[hsl(var(--text-secondary))]">Confirmando seu e-mail...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-danger/10 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Link inválido</h2>
        <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
        <Link href="/login" className="btn-primary w-full">Voltar ao login</Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 className="text-lg font-bold text-emerald-500">E-mail confirmado!</h2>
      <p className="text-sm text-[hsl(var(--text-secondary))]">Sua conta está pronta para uso.</p>
      <Link href="/login" className="btn-primary w-full">Entrar</Link>
    </div>
  );
}

function UnknownActionMessage() {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-warning/10 mx-auto flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-warning" />
      </div>
      <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Ação não reconhecida</h2>
      <p className="text-sm text-[hsl(var(--text-secondary))]">
        O link que você abriu não corresponde a nenhuma ação válida.
      </p>
      <Link href="/login" className="btn-primary w-full">Voltar ao login</Link>
    </div>
  );
}
