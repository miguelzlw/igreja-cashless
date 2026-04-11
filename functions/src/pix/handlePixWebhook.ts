import { onRequest } from "firebase-functions/v2/https";
import { db, REGION } from "../utils/admin";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const mpAccessToken = defineString("MP_ACCESS_TOKEN", {
  description: "Mercado Pago Access Token",
  default: "",
});

/**
 * HTTP Endpoint: Webhook do Mercado Pago.
 * Chamado diretamente pelo Mercado Pago quando o status do pagamento muda.
 * URL: https://<REGION>-<PROJECT>.cloudfunctions.net/handlePixWebhook
 *
 * Verifica o pagamento na API do MP e credita o saldo se aprovado.
 */
export const handlePixWebhook = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    // Apenas POST
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { type, data } = req.body;

      // Mercado Pago envia notificações de vários tipos
      // Apenas processamos "payment"
      if (type !== "payment" || !data?.id) {
        res.status(200).send("OK - ignorado");
        return;
      }

      const mpPaymentId = String(data.id);
      functions.logger.info(`[Webhook] Recebido pagamento: ${mpPaymentId}`);

      // Verificar pagamento na API do Mercado Pago
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
        functions.logger.info(`[Webhook] Pagamento ${mpPaymentId} não aprovado: ${mpPayment?.status}`);
        // Atualizar status se existe no nosso DB
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

      // Buscar registro do pagamento PIX no Firestore
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

      const pixDoc = pixQuery.docs[0];
      const pixData = pixDoc.data();

      // Prevenir processamento duplo
      if (pixData.status === "approved") {
        functions.logger.info(`[Webhook] Pagamento ${mpPaymentId} já processado`);
        res.status(200).send("OK - já processado");
        return;
      }

      // Transação atômica: creditar saldo + atualizar PIX + criar transação
      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(pixData.user_id);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists) {
          functions.logger.error(`[Webhook] Usuário ${pixData.user_id} não encontrado`);
          return;
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        // Atualizar status do PIX
        tx.update(pixDoc.ref, {
          status: "approved",
          approved_at: now,
        });

        // Creditar saldo do usuário
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(pixData.amount_cents),
          updated_at: now,
        });

        // Criar transação de recarga
        const txRef = db.collection("transactions").doc();
        tx.set(txRef, {
          type: "recharge",
          amount_cents: pixData.amount_cents,
          user_id: pixData.user_id,
          user_name: userSnap.data()!.name,
          operator_id: "system",
          operator_name: "PIX Automático",
          payment_method: "pix",
          pix_payment_id: pixDoc.id,
          status: "completed",
          created_at: now,
        });
      });

      functions.logger.info(
        `[Webhook] ✅ Saldo creditado: R$ ${(pixData.amount_cents / 100).toFixed(2)} para ${pixData.user_id}`
      );

      res.status(200).send("OK - processado");
    } catch (error) {
      functions.logger.error("[Webhook] Erro inesperado:", error);
      // Retorna 200 para o MP não reenviar indefinidamente
      res.status(200).send("OK - erro interno");
    }
  }
);
