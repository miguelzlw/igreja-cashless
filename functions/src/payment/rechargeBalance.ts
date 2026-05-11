import { onCall } from "firebase-functions/v2/https";
import { db, REGION, EVENT_CONFIG } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateAmountCents, validateUid } from "../utils/validation";
import { checkRateLimit } from "../security/rateLimiter";
import * as admin from "firebase-admin";

// Métodos de pagamento aceitos numa recarga manual feita pelo caixa.
// "pix" não entra aqui porque PIX é creditado pela Cloud Function creditPixPayment
// (chamada pelo webhook do Asaas), com payment_method="pix" gravado lá.
const VALID_RECHARGE_METHODS = ["dinheiro", "debito", "credito"] as const;
type RechargeMethod = typeof VALID_RECHARGE_METHODS[number];

/**
 * Callable Function: Recarga manual de saldo pelo Caixa.
 * Usado quando o cliente paga em dinheiro/cartão no caixa de recarga.
 *
 * Apenas roles "caixa", "admin" e "desenvolvedor" podem executar.
 */
export const rechargeBalance = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    // 1. Verificar autenticação
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const operatorId = request.auth.uid;
    const { user_id, amount_cents, is_temp = false, payment_method } = request.data as {
      user_id: string;
      amount_cents: number;
      is_temp?: boolean;
      payment_method?: string;
    };

    // 1a. Rate limiting: máximo 30 recargas por minuto por operador
    await checkRateLimit(`recharge_${operatorId}`, 30, 60_000);

    // 2. Validar
    const targetUserId = validateUid(user_id, "user_id");
    const amountCents = validateAmountCents(amount_cents, "amount_cents");

    // payment_method: obrigatório, dentro do whitelist
    const method = String(payment_method || "").toLowerCase() as RechargeMethod;
    if (!(VALID_RECHARGE_METHODS as readonly string[]).includes(method)) {
      throw Errors.INVALID_ARGUMENT(
        "payment_method",
        `Método inválido. Use um de: ${VALID_RECHARGE_METHODS.join(", ")}`
      );
    }

    if (amountCents < EVENT_CONFIG.MIN_RECHARGE_CENTS) {
      throw Errors.INVALID_ARGUMENT("amount_cents", `valor mínimo: R$ ${(EVENT_CONFIG.MIN_RECHARGE_CENTS / 100).toFixed(2)}`);
    }

    if (amountCents > EVENT_CONFIG.MAX_RECHARGE_CENTS) {
      throw Errors.INVALID_ARGUMENT("amount_cents", `valor máximo: R$ ${(EVENT_CONFIG.MAX_RECHARGE_CENTS / 100).toFixed(2)}`);
    }

    // 3. Transação atômica
    const transactionId = await db.runTransaction(async (tx) => {
      // Verificar operador
      const operatorRef = db.collection("users").doc(operatorId);
      const operatorSnap = await tx.get(operatorRef);

      if (!operatorSnap.exists) {
        throw Errors.NOT_FOUND("Operador");
      }

      const operatorData = operatorSnap.data()!;
      if (!["caixa", "admin", "desenvolvedor"].includes(operatorData.role)) {
        throw Errors.PERMISSION_DENIED("realizar recargas");
      }

      // Verificar cliente ou ficha
      const collectionName = is_temp ? "temp_accounts" : "users";
      const targetRef = db.collection(collectionName).doc(targetUserId);
      const targetSnap = await tx.get(targetRef);

      if (!targetSnap.exists) {
        throw Errors.NOT_FOUND(is_temp ? "Ficha Físico" : "Usuário");
      }

      const targetData = targetSnap.data()!;
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Criar transação
      const txRef = db.collection("transactions").doc();
      tx.set(txRef, {
        type: "recharge",
        amount_cents: amountCents,
        user_id: targetUserId,
        user_name: is_temp ? `Ficha #${targetData.code}` : targetData.name,
        operator_id: operatorId,
        operator_name: operatorData.name,
        payment_method: method, // "dinheiro" | "debito" | "credito"
        status: "completed",
        created_at: now,
      });

      // Creditar saldo
      tx.update(targetRef, {
        balance: admin.firestore.FieldValue.increment(amountCents),
        updated_at: now,
      });

      return txRef.id;
    });

    return {
      success: true,
      transaction_id: transactionId,
      message: `Recarga de R$ ${(amountCents / 100).toFixed(2)} realizada com sucesso!`,
    };
  }
);
