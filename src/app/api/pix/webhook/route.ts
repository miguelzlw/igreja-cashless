import { NextRequest, NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase/admin";

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN!;

/**
 * Webhook chamado pelo Asaas quando o status de um pagamento muda.
 * Quando o PIX é confirmado (RECEIVED), creditamos o saldo no Firestore.
 *
 * SEGURANÇA:
 * - Verifica o token secreto no header para garantir que é realmente o Asaas
 * - Usa transação atômica do Firestore para evitar crédito duplo
 * - Registra a transação com todos os dados para auditoria
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar token de segurança
    const token = request.headers.get("asaas-access-token") ||
                  request.nextUrl.searchParams.get("token");

    if (token !== WEBHOOK_TOKEN) {
      console.warn("Webhook PIX: token inválido recebido");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parsear o corpo
    const body = await request.json();
    const event = body.event;
    const payment = body.payment;

    if (!payment?.id) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    console.log(`Webhook PIX: evento=${event}, paymentId=${payment.id}, status=${payment.status}`);

    // 3. Só processar quando o pagamento for confirmado
    if (event !== "PAYMENT_RECEIVED" && payment.status !== "RECEIVED") {
      // Outros eventos (CREATED, PENDING, etc) são ignorados
      return NextResponse.json({ received: true });
    }

    // 4. Buscar registro do pagamento no Firestore
    const pixRef = adminDb.collection("pix_payments").doc(payment.id);

    // 5. Transação atômica: creditar saldo + marcar como processado
    await adminDb.runTransaction(async (tx) => {
      const pixDoc = await tx.get(pixRef);

      if (!pixDoc.exists) {
        console.warn(`Webhook PIX: pagamento ${payment.id} não encontrado no Firestore`);
        return; // Ignora se não encontrou (pode ser PIX externo)
      }

      const pixData = pixDoc.data()!;

      // SEGURANÇA: Não processar duas vezes
      if (pixData.status === "CONFIRMED") {
        console.log(`Webhook PIX: pagamento ${payment.id} já foi processado (duplicata)`);
        return;
      }

      const userId = pixData.user_id;
      const amountCents = pixData.amount_cents;

      // Buscar dados do usuário
      const userRef = adminDb.collection("users").doc(userId);
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        console.error(`Webhook PIX: usuário ${userId} não existe`);
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Creditar saldo do usuário
      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(amountCents),
        updated_at: now,
      });

      // Marcar PIX como confirmado
      tx.update(pixRef, {
        status: "CONFIRMED",
        confirmed_at: now,
        asaas_status: payment.status,
      });

      // Registrar transação para histórico
      const txRef = adminDb.collection("transactions").doc();
      tx.set(txRef, {
        type: "recharge",
        amount_cents: amountCents,
        user_id: userId,
        user_name: pixData.user_name,
        payment_method: "pix",
        pix_payment_id: payment.id,
        status: "completed",
        created_at: now,
      });

      console.log(`Webhook PIX: +${amountCents} centavos creditados ao usuário ${userId}`);
    });

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("Erro no webhook PIX:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Asaas pode enviar GET para verificar se o webhook está ativo
export async function GET() {
  return NextResponse.json({ status: "ok", service: "igreja-cashless-pix-webhook" });
}
