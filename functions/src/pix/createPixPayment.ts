import { onCall } from "firebase-functions/v2/https";
import { db, REGION, EVENT_CONFIG } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateAmountCents } from "../utils/validation";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Mercado Pago secrets
const mpAccessToken = defineString("MP_ACCESS_TOKEN", {
  description: "Mercado Pago Access Token",
  default: "",
});

/**
 * Callable Function: Cria um pagamento PIX via Mercado Pago.
 * O usuário recebe o QR Code PIX para pagar.
 * O webhook confirma o pagamento e credita o saldo.
 */
export const createPixPayment = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const userId = request.auth.uid;
    const { amount_cents } = request.data as { amount_cents: number };

    const amountCents = validateAmountCents(amount_cents, "amount_cents");

    if (amountCents < EVENT_CONFIG.MIN_RECHARGE_CENTS) {
      throw Errors.INVALID_ARGUMENT("amount_cents", `mínimo: R$ ${(EVENT_CONFIG.MIN_RECHARGE_CENTS / 100).toFixed(2)}`);
    }

    if (amountCents > EVENT_CONFIG.MAX_RECHARGE_CENTS) {
      throw Errors.INVALID_ARGUMENT("amount_cents", `máximo: R$ ${(EVENT_CONFIG.MAX_RECHARGE_CENTS / 100).toFixed(2)}`);
    }

    // Verificar se o token está configurado
    const token = mpAccessToken.value();
    if (!token) {
      throw Errors.INTERNAL("Gateway de pagamento não configurado");
    }

    // Verificar usuário
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      throw Errors.NOT_FOUND("Usuário");
    }

    const userData = userSnap.data()!;

    try {
      // Importar Mercado Pago SDK
      const { MercadoPagoConfig, Payment } = await import("mercadopago");

      const client = new MercadoPagoConfig({ accessToken: token });
      const payment = new Payment(client);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + EVENT_CONFIG.PIX_EXPIRATION_MINUTES);

      const result = await payment.create({
        body: {
          transaction_amount: amountCents / 100,
          description: `Recarga SJPII - ${userData.name}`,
          payment_method_id: "pix",
          payer: {
            email: userData.email || `${userId}@sjpii.local`,
          },
          date_of_expiration: expiresAt.toISOString(),
        },
      });

      // Salvar no Firestore
      const pixRef = db.collection("pix_payments").doc();
      await pixRef.set({
        user_id: userId,
        amount_cents: amountCents,
        mp_payment_id: String(result.id),
        mp_qr_code: result.point_of_interaction?.transaction_data?.qr_code || "",
        mp_qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || "",
        status: "pending",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      return {
        success: true,
        pix_payment_id: pixRef.id,
        qr_code: result.point_of_interaction?.transaction_data?.qr_code || "",
        qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || "",
        amount_cents: amountCents,
        expires_at: expiresAt.toISOString(),
      };
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes("invalid")) {
        throw Errors.INTERNAL("Dados de pagamento inválidos");
      }
      throw Errors.INTERNAL("Falha ao criar pagamento PIX");
    }
  }
);
