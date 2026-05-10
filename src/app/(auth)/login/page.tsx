"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmail, resetPassword, getFirebaseErrorMessage } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  // Se já logado, redireciona
  if (user) {
    router.replace("/");
    return null;
  }

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email.trim(), password);
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
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary-300/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary-400 to-primary-300 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-primary/30 mb-4">
            SJ
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">
            Festa São João
          </h1>
          <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
            Sistema Cashless — SJPII
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-center mb-6 text-[hsl(var(--text-primary))]">
            Entrar na conta
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm text-center animate-slide-down" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                E-mail
              </label>
              <input
                id="email"
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
              <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base"
              id="login-button"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Actions */}
          <div className="flex flex-col items-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => { setShowResetModal(true); setResetEmail(email); setResetSuccess(""); setResetError(""); }}
              className="text-sm font-semibold text-[hsl(var(--text-secondary))] hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Esqueceu sua senha?
            </button>
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              Não tem conta?{" "}
              <Link
                href="/register"
                className="text-primary font-semibold hover:text-primary-hover transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[hsl(var(--text-muted))] mt-6">
          Paróquia São João Paulo II
        </p>
      </div>

      {/* Modal Recuperar Senha */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !resetLoading && setShowResetModal(false)} />
          <div className="relative w-full max-w-sm glass-card overflow-hidden animate-slide-up shadow-2xl rounded-2xl">

            {/* Header com gradiente */}
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-6 pt-6 pb-5 border-b border-[hsl(var(--border))]/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[hsl(var(--text-primary))] leading-tight">Recuperar Senha</h3>
                    <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">Enviaremos um link para seu e-mail</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResetModal(false)}
                  disabled={resetLoading}
                  className="p-1.5 rounded-full hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))] shrink-0 mt-0.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Aviso de SPAM — escancarado */}
              {!resetSuccess && (
                <div className="flex gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5">
                  <span className="text-xl shrink-0 mt-0.5">📬</span>
                  <div className="text-xs text-amber-400 leading-relaxed space-y-1">
                    <p className="font-bold text-sm text-amber-300">Verifique o SPAM!</p>
                    <p>
                      O e-mail de recuperação <strong>quase sempre cai na pasta de Spam</strong> ou Lixo Eletrônico.
                      Se não aparecer na caixa de entrada em 1 minuto, <strong>abra o Spam antes de tentar de novo</strong>.
                    </p>
                  </div>
                </div>
              )}

              {resetError && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 p-3 rounded-xl">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {resetError}
                </div>
              )}

              {resetSuccess ? (
                /* Estado de sucesso */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mx-auto flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-[hsl(var(--text-primary))]">E-mail enviado!</p>
                    <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
                      Verifique <strong>{resetEmail}</strong>
                    </p>
                  </div>
                  {/* Aviso de spam pós-envio — ainda mais enfático */}
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-left space-y-2">
                    <p className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <span>⚠️</span> Não chegou na caixa de entrada?
                    </p>
                    <ol className="text-xs text-amber-400/90 space-y-1.5 list-none">
                      <li className="flex gap-2"><span className="font-bold shrink-0">1.</span> Abra a pasta <strong>SPAM</strong> ou <strong>Lixo Eletrônico</strong></li>
                      <li className="flex gap-2"><span className="font-bold shrink-0">2.</span> Procure um e-mail de <strong>noreply@...</strong></li>
                      <li className="flex gap-2"><span className="font-bold shrink-0">3.</span> Marque como "Não é spam" e abra o link</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="btn-primary w-full py-3"
                  >
                    Entendi, vou verificar
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!resetEmail.trim()) return;
                  setResetLoading(true);
                  setResetError("");
                  setResetSuccess("");
                  try {
                    await resetPassword(resetEmail.trim());
                    setResetSuccess("enviado");
                  } catch (err: unknown) {
                    const firebaseError = err as { code?: string };
                    setResetError(getFirebaseErrorMessage(firebaseError.code || ""));
                  } finally {
                    setResetLoading(false);
                  }
                }} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-1.5">Seu e-mail de cadastro</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="input"
                      disabled={resetLoading}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim()}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    {resetLoading ? "Enviando..." : "Enviar Link de Recuperação"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
