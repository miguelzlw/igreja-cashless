"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpWithEmail, signInWithGoogle, getFirebaseErrorMessage } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/hooks/useAuth";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Se já logado, redireciona
  if (user) {
    router.replace("/");
    return null;
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações client-side
    if (name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      await signUpWithEmail(email.trim(), password, name.trim());
      router.replace("/");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      setError(getFirebaseErrorMessage(firebaseError.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      setError(getFirebaseErrorMessage(firebaseError.code || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--bg))] relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-success/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary-400 to-primary-300 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-primary/30 mb-4">
            SJ
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
            Criar Conta
          </h1>
          <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
            Junte-se à Festa de São João
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm text-center animate-slide-down" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Seu nome"
                required
                autoComplete="name"
                disabled={loading}
                minLength={2}
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                E-mail
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="seu@email.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                Confirmar senha
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Repita a senha"
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base"
              id="register-button"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[hsl(var(--border))]" />
            <span className="text-xs text-[hsl(var(--text-muted))] uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-[hsl(var(--border))]" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleRegister}
            disabled={loading}
            className="btn-secondary w-full text-base"
            id="google-register-button"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Cadastrar com Google
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-[hsl(var(--text-secondary))] mt-6">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:text-primary-hover transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[hsl(var(--text-muted))] mt-6">
          Ao criar uma conta, você concorda com os termos de uso do evento.
        </p>
      </div>
    </div>
  );
}
