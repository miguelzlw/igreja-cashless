import { onRequest } from "firebase-functions/v2/https";
import { db, REGION } from "../utils/admin";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";

const mpAccessToken = defineString("MP_ACCESS_TOKEN", {
  description: "Mercado Pago Access Token",
  default: "",
});

const mpWebhookSecret = defineString("MP_WEBHOOK_SECRET", {
  description: "Mercado Pago Webhook Secret para verificação de assinatura",
});

/**
 * Verifica a assinatura do webhook do Mercado Pago.
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function verifyMPSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  try {
    // x-signature: "ts=<timestamp>,v1=<hash>"
    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => p.split("=") as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

/**
 * HTTP Endpoint: Webhook do Mercado Pago.
 * Verifica assinatura HMAC-SHA256, depois confirma o pagamento na API do MP
 * e credita o saldo atomicamente (sem TOCTOU).
 */
export const handlePixWebhook = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      // ── 1. Verificar assinatura ──────────────────────────────
      const xSignature = req.headers["x-signature"] as string | undefined;
      const xRequestId = req.headers["x-request-id"] as string | undefined;
      const secret = mpWebhookSecret.value();

      if (!xSignature || !xRequestId) {
        functions.logger.warn("[Webhook] Headers de assinatura ausentes");
        res.status(401).send("Unauthorized");
        return;
      }

      const { type, data } = req.body;

      if (type !== "payment" || !data?.id) {
        res.status(200).send("OK - ignorado");
        return;
      }

      const mpPaymentId = String(data.id);

      if (!verifyMPSignature(xSignature, xRequestId, mpPaymentId, secret)) {
        functions.logger.warn(`[Webhook] Assinatura inválida para pagamento ${mpPaymentId}`);
        res.status(401).send("Unauthorized");
        return;
      }

      functions.logger.info(`[Webhook] Assinatura válida — pagamento: ${mpPaymentId}`);

      // ── 2. Verificar pagamento na API do Mercado Pago ────────
      const token = mpAccessToken.value();
      if (!token) {
        functions.logger.error("[Webhook] MP_ACCESS_TOKEN não configurado");
        res.status(500).send("Config error");
        return;
      }

      const { MercadoPagoConfig, Payment } = await import("mercadopago");
      const client = new MercadoPagoConfig({ accessToken: token });
      const paymentApi = new Payment(client);

      const mpPayment = await paymentApi.get({ id: mpPaymentId });

      if (!mpPayment || mpPayment.status !== "approved") {
        functions.logger.info(
          `[Webhook] Pagamento ${mpPaymentId} não aprovado: ${mpPayment?.status}`
        );

        const existingQuery = await db
          .collection("pix_payments")
          .where("mp_payment_id", "==", mpPaymentId)
          .limit(1)
          .get();

        if (!existingQuery.empty && mpPayment?.status) {
          await existingQuery.docs[0].ref.update({
            status: mpPayment.status === "rejected" ? "rejected" : "pending",
          });
        }

        res.status(200).send("OK - não aprovado");
        return;
      }

      // ── 3. Buscar registro do PIX ────────────────────────────
      const pixQuery = await db
        .collection("pix_payments")
        .where("mp_payment_id", "==", mpPaymentId)
        .limit(1)
        .get();

      if (pixQuery.empty) {
        functions.logger.warn(`[Webhook] Pagamento ${mpPaymentId} não encontrado no Firestore`);
        res.status(200).send("OK - não encontrado");
        return;
      }

      const pixDocRef = pixQuery.docs[0].ref;
      const pixDocId = pixQuery.docs[0].id;

      // ── 4. Transação atômica com verificação de idempotência ─
      // A re-leitura do pixDoc DENTRO da transação evita race conditions (TOCTOU).
      await db.runTransaction(async (tx) => {
        const pixSnap = await tx.get(pixDocRef);

        if (!pixSnap.exists) {
          functions.logger.error(`[Webhook] Documento PIX ${pixDocId} sumiu`);
          return;
        }

        const pixData = pixSnap.data()!;

        if (pixData.status === "approved") {
          functions.logger.info(`[Webhook] Pagamento ${mpPaymentId} já processado (idempotente)`);
          return;
        }

        const userRef = db.collection("users").doc(pixData.user_id);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists) {
          functions.logger.error(`[Webhook] Usuário ${pixData.user_id} não encontrado`);
          return;
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.update(pixDocRef, {
          status: "approved",
          approved_at: now,
        });

        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(pixData.amount_cents),
          updated_at: now,
        });

        const txRef = db.collection("transactions").doc();
        tx.set(txRef, {
          type: "recharge",
          amount_cents: pixData.amount_cents,
          user_id: pixData.user_id,
          user_name: userSnap.data()!.name,
          operator_id: "system",
          operator_name: "PIX Automático",
          payment_method: "pix",
          pix_payment_id: pixDocId,
          status: "completed",
          created_at: now,
        });
      });

      functions.logger.info(
        `[Webhook] ✅ Saldo creditado para ${pixQuery.docs[0].data().user_id}`
      );

      res.status(200).send("OK - processado");
    } catch (error) {
      functions.logger.error("[Webhook] Erro inesperado:", error);
      res.status(200).send("OK - erro interno");
    }
  }
);
