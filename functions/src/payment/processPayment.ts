import { onCall } from "firebase-functions/v2/https";
import { db, REGION } from "../utils/admin";
import { Errors } from "../utils/errors";
import { validateUid, validateSaleItems } from "../utils/validation";
import { parseQRPayload, safeEqual } from "../utils/hmac";
import { checkRateLimit } from "../security/rateLimiter";
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

    // 1a. Rate limiting: máximo 60 vendas por minuto por operador
    await checkRateLimit(`payment_${operatorId}`, 60, 60_000);

    const {
      qr_payload,
      items,
      stall_id,
    } = request.data as {
      qr_payload: string;
      items: unknown;
      stall_id: string;
    };

    // 2. Parsear QR (a verificação acontece dentro da transação contra o qr_hmac armazenado)
    if (!qr_payload || typeof qr_payload !== "string") {
      throw Errors.INVALID_ARGUMENT("qr_payload", "QR Code inválido");
    }

    const parsed = parseQRPayload(qr_payload);
    if (!parsed) {
      throw Errors.INVALID_ARGUMENT("qr_payload", "QR Code inválido");
    }

    const customerId = parsed.uid;
    const providedHmac = parsed.hmac;
    const isTempAccount = parsed.is_temp;

    // 3. Validar itens (estrutura)
    const validatedItems = validateSaleItems(items);
    const stallId = validateUid(stall_id, "stall_id");

    // O total é calculado mais abaixo USANDO O PREÇO DO BANCO (não o do cliente).
    // O unit_price_cents enviado pelo cliente é IGNORADO para evitar fraude
    // (vendedor adulterando payload pra cobrar 1 centavo).

    // 5. Executar transação atômica
    const transactionId = await db.runTransaction(async (tx) => {
      // Buscar operador (vendedor/gerente)
      const operatorRef = db.collection("users").doc(operatorId);
      const operatorSnap = await tx.get(operatorRef);

      if (!operatorSnap.exists) {
        throw Errors.NOT_FOUND("Operador");
      }

      const operatorData = operatorSnap.data()!;
      if (!["vendedor", "gerente_barraca", "admin", "desenvolvedor"].includes(operatorData.role)) {
        throw Errors.PERMISSION_DENIED("processar vendas");
      }

      // Verificar que o operador pertence à barraca (exceto admin/desenvolvedor)
      if (operatorData.role !== "admin" && operatorData.role !== "desenvolvedor" && operatorData.stall_id !== stallId) {
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

      // Buscar cliente ou ficha
      const collectionName = isTempAccount ? "temp_accounts" : "users";
      const customerRef = db.collection(collectionName).doc(customerId);
      const customerSnap = await tx.get(customerRef);

      if (!customerSnap.exists) {
        throw Errors.NOT_FOUND(isTempAccount ? "Ficha Físico" : "Cliente");
      }

      const customerData = customerSnap.data()!;

      // Verificar autenticidade do QR contra o hmac armazenado no documento.
      // Para fichas físicas, o "hmac" é literalmente "temp_<uid>" (sem segredo).
      const storedHmac = isTempAccount ? `temp_${customerId}` : (customerData.qr_hmac || "");
      if (!storedHmac || !safeEqual(providedHmac, storedHmac)) {
        throw Errors.INVALID_ARGUMENT("qr_payload", "QR Code inválido ou adulterado");
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // PRIMEIRO: ler todos os produtos (transações Firestore exigem todas as
      // leituras ANTES de qualquer escrita — fazer read-after-write quebra).
      const productReads = await Promise.all(
        validatedItems.map(async (item) => {
          const productRef = db
            .collection("stalls")
            .doc(stallId)
            .collection("products")
            .doc(item.product_id);
          const snap = await tx.get(productRef);
          return { item, ref: productRef, snap };
        })
      );

      // DEPOIS: validar produtos, calcular o total USANDO O PREÇO DO BANCO,
      // e montar a lista canônica de itens (não confiamos no cliente para
      // unit_price_cents — só pra product_id e quantity).
      let totalCents = 0;
      const canonicalItems: Array<{
        product_id: string;
        name: string;
        quantity: number;
        unit_price_cents: number;
      }> = [];
      const productUpdates: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: Record<string, unknown>;
      }> = [];

      for (const { item, ref: productRef, snap: productSnap } of productReads) {
        if (!productSnap.exists) {
          throw Errors.NOT_FOUND(`Produto "${item.name}"`);
        }

        const productData = productSnap.data()!;

        // Preço VEM DO BANCO. unit_price_cents do cliente é descartado.
        const serverPriceCents = productData.price_cents;
        if (typeof serverPriceCents !== "number" || serverPriceCents <= 0) {
          throw Errors.INVALID_ARGUMENT("items", `Produto "${productData.name || item.name}" sem preço válido`);
        }

        // Produto precisa estar ativo
        if (productData.active === false) {
          throw Errors.INVALID_ARGUMENT("items", `Produto "${productData.name || item.name}" está indisponível`);
        }

        const lineTotal = serverPriceCents * item.quantity;
        totalCents += lineTotal;

        canonicalItems.push({
          product_id: item.product_id,
          name: productData.name || item.name,
          quantity: item.quantity,
          unit_price_cents: serverPriceCents,
        });

        const baseUpdate: Record<string, unknown> = {
          units_sold: admin.firestore.FieldValue.increment(item.quantity),
          revenue_cents: admin.firestore.FieldValue.increment(lineTotal),
          updated_at: now,
        };

        if (productData.stock !== -1) {
          if (productData.stock < item.quantity) {
            throw Errors.INVALID_ARGUMENT(
              "items",
              `"${productData.name || item.name}" não tem estoque suficiente (disponível: ${productData.stock})`
            );
          }
          baseUpdate.stock = admin.firestore.FieldValue.increment(-item.quantity);
        }

        productUpdates.push({ ref: productRef, data: baseUpdate });
      }

      if (totalCents <= 0) {
        throw Errors.INVALID_ARGUMENT("items", "total deve ser maior que zero");
      }

      // Verificar saldo (agora que sabemos o total real)
      if (customerData.balance < totalCents) {
        throw Errors.INSUFFICIENT_BALANCE(totalCents, customerData.balance);
      }

      // Aplicar updates de produtos
      for (const upd of productUpdates) {
        tx.update(upd.ref, upd.data);
      }

      // Criar transação
      const txRef = db.collection("transactions").doc();

      tx.set(txRef, {
        type: "purchase",
        amount_cents: totalCents,
        user_id: customerId,
        user_name: isTempAccount ? `Ficha #${customerData.code}` : customerData.name,
        stall_id: stallId,
        stall_name: stallData.name,
        operator_id: operatorId,
        operator_name: operatorData.name,
        items: canonicalItems, // itens com preço do banco (não do cliente)
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

      return { txId: txRef.id, totalCents };
    });

    return {
      success: true,
      transaction_id: transactionId.txId,
      total_cents: transactionId.totalCents,
      message: `Venda de R$ ${(transactionId.totalCents / 100).toFixed(2)} realizada com sucesso!`,
    };
  }
);
