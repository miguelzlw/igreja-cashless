import { onCall } from "firebase-functions/v2/https";
import { db, REGION } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateUid, validateString } from "../utils/validation";
import * as admin from "firebase-admin";

/**
 * Callable Function: Estorno de uma transação.
 * Apenas Caixa e Admin podem estornar.
 * O estorno reverte o saldo ao cliente e marca a transação original.
 */
export const processRefund = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const operatorId = request.auth.uid;
    const { transaction_id, reason } = request.data as {
      transaction_id: string;
      reason?: string;
    };

    const txId = validateUid(transaction_id, "transaction_id");
    const refundReason = reason ? validateString(reason, "reason", 3, 200) : "Estorno solicitado";

    const refundId = await db.runTransaction(async (tx) => {
      // Verificar operador
      const operatorRef = db.collection("users").doc(operatorId);
      const operatorSnap = await tx.get(operatorRef);

      if (!operatorSnap.exists) {
        throw Errors.NOT_FOUND("Operador");
      }

      const operatorData = operatorSnap.data()!;
      if (!["caixa", "admin"].includes(operatorData.role)) {
        throw Errors.PERMISSION_DENIED("realizar estornos");
      }

      // Buscar transação original
      const originalRef = db.collection("transactions").doc(txId);
      const originalSnap = await tx.get(originalRef);

      if (!originalSnap.exists) {
        throw Errors.NOT_FOUND("Transação");
      }

      const originalData = originalSnap.data()!;

      if (originalData.status === "refunded") {
        throw Errors.INVALID_ARGUMENT("transaction_id", "transação já foi estornada");
      }

      if (originalData.status !== "completed") {
        throw Errors.INVALID_ARGUMENT("transaction_id", "apenas transações concluídas podem ser estornadas");
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Criar transação de estorno
      const refundRef = db.collection("transactions").doc();
      tx.set(refundRef, {
        type: "refund",
        amount_cents: originalData.amount_cents,
        user_id: originalData.user_id,
        user_name: originalData.user_name,
        stall_id: originalData.stall_id || null,
        stall_name: originalData.stall_name || null,
        operator_id: operatorId,
        operator_name: operatorData.name,
        refund_of: txId,
        refund_reason: refundReason,
        status: "completed",
        created_at: now,
      });

      // Marcar transação original como estornada
      tx.update(originalRef, {
        status: "refunded",
        refunded_at: now,
        refunded_by: operatorId,
      });

      // Devolver saldo ao cliente
      const customerRef = db.collection("users").doc(originalData.user_id);
      tx.update(customerRef, {
        balance: admin.firestore.FieldValue.increment(originalData.amount_cents),
        updated_at: now,
      });

      // Se era venda, reverter total da barraca
      if (originalData.type === "purchase" && originalData.stall_id) {
        const stallRef = db.collection("stalls").doc(originalData.stall_id);
        tx.update(stallRef, {
          total_sales_cents: admin.firestore.FieldValue.increment(-originalData.amount_cents),
        });
      }

      return refundRef.id;
    });

    return {
      success: true,
      refund_id: refundId,
      message: "Estorno realizado com sucesso!",
    };
  }
);
