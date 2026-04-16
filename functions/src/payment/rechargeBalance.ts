import { onCall } from "firebase-functions/v2/https";
import { db, REGION, EVENT_CONFIG } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateAmountCents, validateUid } from "../utils/validation";
import { checkRateLimit } from "../security/rateLimiter";
import * as admin from "firebase-admin";

/**
 * Callable Function: Recarga manual de saldo pelo Caixa.
 * Usado quando o cliente paga em dinheiro no caixa de recarga.
 *
 * Apenas roles "caixa" e "admin" podem executar.
 */
export const rechargeBalance = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    // 1. Verificar autenticação
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const operatorId = request.auth.uid;
    const { user_id, amount_cents } = request.data as {
      user_id: string;
      amount_cents: number;
    };

    // 1a. Rate limiting: máximo 30 recargas por minuto por operador
    await checkRateLimit(`recharge_${operatorId}`, 30, 60_000);

    // 2. Validar
    const targetUserId = validateUid(user_id, "user_id");
    const amountCents = validateAmountCents(amount_cents, "amount_cents");

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
      if (!["caixa", "admin"].includes(operatorData.role)) {
        throw Errors.PERMISSION_DENIED("realizar recargas");
      }

      // Verificar cliente
      const targetRef = db.collection("users").doc(targetUserId);
      const targetSnap = await tx.get(targetRef);

      if (!targetSnap.exists) {
        throw Errors.NOT_FOUND("Usuário");
      }

      const targetData = targetSnap.data()!;
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Criar transação
      const txRef = db.collection("transactions").doc();
      tx.set(txRef, {
        type: "recharge",
        amount_cents: amountCents,
        user_id: targetUserId,
        user_name: targetData.name,
        operator_id: operatorId,
        operator_name: operatorData.name,
        payment_method: "manual",
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
