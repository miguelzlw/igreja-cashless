import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Limita de quais origens o navegador pode carregar recursos. Caso entre um
 * XSS no app, a CSP impede que o atacante exfiltre dados pra um domínio
 * arbitrário ou injete scripts externos.
 *
 * Notas sobre o que precisa estar liberado:
 * - 'self': nosso próprio domínio (Vercel)
 * - Firebase Auth/Firestore: identitytoolkit, securetoken, firestore.googleapis
 * - Firebase Realtime/Storage: firebaseio, firebasestorage
 * - Asaas: API de pagamento (não chamada do navegador, mas QR pode vir)
 * - 'unsafe-inline'/'unsafe-eval' em script-src: Next.js precisa (usa hydration
 *   e código gerado em runtime). Sem nonce setup completo, não dá pra evitar.
 * - data: em img-src: QR codes vêm como data:image/png;base64,...
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.firebasestorage.googleapis.com",
  "frame-src 'self' https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Remove a bolinha de "Issues" em desenvolvimento
  devIndicators: false,
  poweredByHeader: false,

  // Headers de segurança
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
