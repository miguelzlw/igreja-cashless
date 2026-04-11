import * as functions from "firebase-functions/v1";
import { db } from "../utils/admin";
import { generateHMAC } from "../utils/hmac";

/**
 * Auth Trigger: executado quando um novo usuário é criado no Firebase Auth.
 * Cria o documento do usuário no Firestore com role "user" e saldo zero.
 * Gera o HMAC para o QR Code.
 */
export const onUserCreate = functions
  .region("southamerica-east1")
  .auth.user()
  .onCreate(async (user) => {
    const { uid, email, displayName } = user;

    const now = new Date();
    const qrHmac = generateHMAC(uid);

    const userDoc = {
      uid,
      email: email || "",
      name: displayName || email?.split("@")[0] || "Usuário",
      role: "user" as const,
      balance: 0,
      qr_hmac: qrHmac,
      is_temp: false,
      created_at: now,
      updated_at: now,
    };

    try {
      await db.collection("users").doc(uid).set(userDoc);
      functions.logger.info(`[onUserCreate] Usuário criado: ${uid} (${email})`);
    } catch (error) {
      functions.logger.error(`[onUserCreate] Erro ao criar documento do usuário ${uid}:`, error);
      throw error;
    }
  });
