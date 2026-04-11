import * as crypto from "crypto";
import { defineString } from "firebase-functions/params";

/**
 * Secret definido no Firebase Functions config
 * firebase functions:secrets:set HMAC_SECRET
 */
const hmacSecret = defineString("HMAC_SECRET", {
  description: "Segredo HMAC para assinatura de QR Codes",
  default: "dev-hmac-secret-change-me-in-production",
});

/**
 * Gera o HMAC-SHA256 do UID do usuário.
 * Este valor é armazenado no documento do usuário e codificado no QR Code.
 * Permite verificar que o QR Code é autêntico sem precisar consultar o Firestore
 * durante o scan (o vendedor valida localmente).
 */
export function generateHMAC(uid: string): string {
  const secret = hmacSecret.value();
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
 * Decodifica e valida o payload do QR Code
 * Retorna o UID se válido, null se inválido
 */
export function parseAndVerifyQR(payload: string): string | null {
  const parts = payload.split(":");
  if (parts.length !== 2) return null;

  const [uid, hmac] = parts;
  if (!uid || !hmac) return null;

  if (verifyHMAC(uid, hmac)) {
    return uid;
  }

  return null;
}
