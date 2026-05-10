import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { db, REGION } from "../utils/admin";

/**
 * Secret compartilhado entre o webhook PIX (Next.js API route) e esta Cloud Function.
 * O webhook assina o body com HMAC-SHA256 usando este segredo; só pedidos
 * com assinatura válida são aceitos.
 *
 * Configurar com: firebase functions:secrets:set INTERNAL_WEBHOOK_SECRET
 */
const INTERNAL_WEBHOOK_SECRET = defineSecret("INTERNAL_WEBHOOK_SECRET");

interface CreditPixPaymentBody {
  payment_id: string;
  asaas_status?: string | null;
}

/**
 * HTTPS function chamada pelo webhook do Asaas (em src/app/api/pix/webhook).
 * Faz o crédito do saldo do usuário em uma transação atômica e idempotente:
 *  - Se o pix_payment já está CONFIRMED, retorna sucesso sem reprocessar.
 *  - Se está PENDING, marca como CONFIRMED, credita o saldo e cria a transação.
 *
 * Autenticação: HMAC-SHA256 do corpo da requisição com INTERNAL_WEBHOOK_SECRET,
 * comparado em tempo constante (timingSafeEqual).
 */
export const creditPixPayment = onRequest(
  { region: REGION, secrets: [INTERNAL_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    // 1. Verificar assinatura HMAC
    const signature = req.headers["x-internal-signature"];
    if (typeof signature !== "string" || !signature) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
    const bodyString = rawBody ? rawBody.toString("utf8") : JSON.stringify(req.body ?? {});

    const expectedSignature = crypto
      .createHmac("sha256", INTERNAL_WEBHOOK_SECRET.value())
      .update(bodyString)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.warn("creditPixPayment: assinatura inválida");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 2. Validar payload
    const { payment_id, asaas_status } = (req.body ?? {}) as CreditPixPaymentBody;
    if (!payment_id || typeof payment_id !== "string") {
      res.status(400).json({ error: "Missing or invalid payment_id" });
      return;
    }

    // 3. Transação atômica e idempotente
    try {
      const result = await db.runTransaction(async (tx) => {
        const pixRef = db.collection("pix_payments").doc(payment_id);
        const pixSnap = await tx.get(pixRef);

        if (!pixSnap.exists) {
          return { ok: false, reason: "pix_payment_not_found" as const };
        }

        const pixData = pixSnap.data()!;

        // Idempotência: já creditado? retorna sucesso sem reprocessar
        if (pixData.status === "CONFIRMED") {
          return { ok: true, already_processed: true };
        }

        const userId = pixData.user_id as string | undefined;
        const amountCents = pixData.amount_cents as number | undefined;
        const userName = (pixData.user_name as string | undefined) || "";

        if (!userId || !amountCents || amountCents <= 0) {
          throw new Error(`pix_payment ${payment_id} com dados inválidos`);
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error(`Usuário ${userId} não encontrado`);
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        // Marca pix_payment como confirmado
        tx.update(pixRef, {
          status: "CONFIRMED",
          confirmed_at: now,
          asaas_status: asaas_status ?? null,
        });

        // Credita o saldo (atômico via increment)
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(amountCents),
          updated_at: now,
        });

        // Cria transação para o histórico (id determinístico = idempotência extra)
        const txRef = db.collection("transactions").doc(`pix_${payment_id}`);
        tx.set(txRef, {
          type: "recharge",
          amount_cents: amountCents,
          user_id: userId,
          user_name: userName,
          payment_method: "pix",
          pix_payment_id: payment_id,
          operator_id: "system",
          operator_name: "PIX (Asaas)",
          status: "completed",
          created_at: now,
        });

        return { ok: true, credited: amountCents };
      });

      if (!result.ok) {
        console.warn(`creditPixPayment: ${payment_id} → ${result.reason}`);
        res.status(404).json(result);
        return;
      }

      console.log(`creditPixPayment: ${payment_id} processado`, result);
      res.json(result);
    } catch (err) {
      console.error("creditPixPayment erro:", err);
      res.status(500).json({ error: String(err) });
    }
  }
);
