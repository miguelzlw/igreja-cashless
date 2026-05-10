import * as crypto from "crypto";
import { defineString } from "firebase-functions/params";

/**
 * Secret definido no Firebase Functions config
 * firebase functions:secrets:set HMAC_SECRET
 */
const hmacSecret = defineString("HMAC_SECRET", {
  description: "Segredo HMAC para assinatura de QR Codes. Troque em produção via: firebase functions:secrets:set HMAC_SECRET",
  default: "dev-default-troque-em-producao",
});

/**
 * Gera o HMAC-SHA256 do UID do usuário.
 * Este valor é armazenado no documento do usuário e codificado no QR Code.
 * Permite verificar que o QR Code é autêntico sem precisar consultar o Firestore
 * durante o scan (o vendedor valida localmente).
 */
export function generateHMAC(uid: string): string {
  const secret = hmacSecret.value();
  if (!secret) {
    throw new Error("HMAC_SECRET não configurado. Execute: firebase functions:secrets:set HMAC_SECRET");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(uid)
    .digest("hex");
}

/**
 * Verifica que o HMAC fornecido é válido para o UID.
 * Usa comparação constant-time para prevenir timing attacks.
 */
export function verifyHMAC(uid: string, providedHmac: string): boolean {
  const expected = generateHMAC(uid);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(providedHmac, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Gera o conteúdo do QR Code: uid:hmac
 */
export function generateQRPayload(uid: string): string {
  const hmac = generateHMAC(uid);
  return `${uid}:${hmac}`;
}

/**
 * Decodifica e valida o payload do QR Code (verificação HMAC server-side).
 * Retorna o objeto com UID e a indicação is_temp, nulo se for inválido.
 *
 * NOTA: usar essa função exige que o QR tenha sido gerado com o mesmo HMAC_SECRET
 * que o servidor conhece. O cliente atual gera HMAC localmente com outra fórmula,
 * por isso essa função normalmente falha — use `parseQRPayload` + comparação contra
 * `qr_hmac` armazenado no documento do usuário.
 */
export function parseAndVerifyQR(payload: string): { uid: string, is_temp: boolean } | null {
  const parts = payload.split(":");
  if (parts.length !== 2) return null;

  const [uid, hmac] = parts;
  if (!uid || !hmac) return null;

  if (hmac === `temp_${uid}`) {
    return { uid, is_temp: true };
  }

  if (verifyHMAC(uid, hmac)) {
    return { uid, is_temp: false };
  }

  return null;
}

/**
 * Parseia o payload do QR Code sem verificar (apenas extrai uid e hmac).
 * A verificação fica a cargo do chamador, comparando o hmac com o valor
 * `qr_hmac` armazenado no documento do usuário/ficha (constant-time).
 */
export function parseQRPayload(payload: string): { uid: string; hmac: string; is_temp: boolean } | null {
  const parts = payload.split(":");
  if (parts.length !== 2) return null;
  const [uid, hmac] = parts;
  if (!uid || !hmac) return null;
  return { uid, hmac, is_temp: hmac === `temp_${uid}` };
}

/**
 * Comparação constant-time de duas strings hex/UTF-8 do mesmo tamanho.
 * Retorna false se tamanhos diferirem (também sem leak de timing).
 */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
