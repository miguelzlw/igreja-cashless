import { onCall } from "firebase-functions/v2/https";
import { db, REGION } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateUid, validateSaleItems } from "../utils/validation";
import { parseAndVerifyQR } from "../utils/hmac";
import * as admin from "firebase-admin";

/**
 * Callable Function: Processa uma venda (débito no saldo do cliente).
 * Chamada pelo vendedor após scanear o QR Code do cliente.
 *
 * Toda a lógica financeira acontece em uma transação atômica do Firestore.
 */
export const processPayment = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    // 1. Verificar autenticação
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const operatorId = request.auth.uid;
    const {
      qr_payload,
      items,
      stall_id,
    } = request.data as {
      qr_payload: string;
      items: unknown;
      stall_id: string;
    };

    // 2. Validar e verificar QR Code
    if (!qr_payload || typeof qr_payload !== "string") {
      throw Errors.INVALID_ARGUMENT("qr_payload", "QR Code inválido");
    }

    const customerId = parseAndVerifyQR(qr_payload);
    if (!customerId) {
      throw Errors.INVALID_ARGUMENT("qr_payload", "QR Code inválido ou adulterado");
    }

    // 3. Validar itens
    const validatedItems = validateSaleItems(items);
    const stallId = validateUid(stall_id, "stall_id");

    // 4. Calcular total
    const totalCents = validatedItems.reduce(
      (sum, item) => sum + item.unit_price_cents * item.quantity,
      0
    );

    if (totalCents <= 0) {
      throw Errors.INVALID_ARGUMENT("items", "total deve ser maior que zero");
    }

    // 5. Executar transação atômica
    const transactionId = await db.runTransaction(async (tx) => {
      // Buscar operador (vendedor/gerente)
      const operatorRef = db.collection("users").doc(operatorId);
      const operatorSnap = await tx.get(operatorRef);

      if (!operatorSnap.exists) {
        throw Errors.NOT_FOUND("Operador");
      }

      const operatorData = operatorSnap.data()!;
      if (!["vendedor", "gerente_barraca", "admin"].includes(operatorData.role)) {
        throw Errors.PERMISSION_DENIED("processar vendas");
      }

      // Verificar que o operador pertence à barraca (exceto admin)
      if (operatorData.role !== "admin" && operatorData.stall_id !== stallId) {
        throw Errors.PERMISSION_DENIED("vender nesta barraca");
      }

      // Buscar barraca
      const stallRef = db.collection("stalls").doc(stallId);
      const stallSnap = await tx.get(stallRef);

      if (!stallSnap.exists) {
        throw Errors.NOT_FOUND("Barraca");
      }

      const stallData = stallSnap.data()!;
      if (!stallData.is_active) {
        throw Errors.INVALID_ARGUMENT("stall_id", "barraca está inativa");
      }

      // Buscar cliente
      const customerRef = db.collection("users").doc(customerId);
      const customerSnap = await tx.get(customerRef);

      if (!customerSnap.exists) {
        throw Errors.NOT_FOUND("Cliente");
      }

      const customerData = customerSnap.data()!;

      // Verificar saldo
      if (customerData.balance < totalCents) {
        throw Errors.INSUFFICIENT_BALANCE(totalCents, customerData.balance);
      }

      // Criar transação
      const txRef = db.collection("transactions").doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(txRef, {
        type: "purchase",
        amount_cents: totalCents,
        user_id: customerId,
        user_name: customerData.name,
        stall_id: stallId,
        stall_name: stallData.name,
        operator_id: operatorId,
        operator_name: operatorData.name,
        items: validatedItems,
        payment_method: "balance",
        status: "completed",
        created_at: now,
      });

      // Debitar saldo do cliente
      tx.update(customerRef, {
        balance: admin.firestore.FieldValue.increment(-totalCents),
        updated_at: now,
      });

      // Atualizar total de vendas da barraca
      tx.update(stallRef, {
        total_sales_cents: admin.firestore.FieldValue.increment(totalCents),
      });

      return txRef.id;
    });

    return {
      success: true,
      transaction_id: transactionId,
      total_cents: totalCents,
      message: `Venda de R$ ${(totalCents / 100).toFixed(2)} realizada com sucesso!`,
    };
  }
);
