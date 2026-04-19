import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN!;
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

/**
 * Lê um documento do Firestore via REST API
 */
async function firestoreGet(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Atualiza campos de um documento no Firestore via REST API
 */
async function firestorePatch(collection: string, docId: string, fields: Record<string, unknown>, updateMask: string[]) {
  const firestoreFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      firestoreFields[key] = { integerValue: String(value) };
    } else if (typeof value === "boolean") {
      firestoreFields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      firestoreFields[key] = { timestampValue: value.toISOString() };
    }
  }

  const maskParam = updateMask.map(f => `updateMask.fieldPaths=${f}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${maskParam}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  return res.ok;
}

/**
 * Cria um documento no Firestore via REST
 */
async function firestoreCreate(collection: string, docId: string, fields: Record<string, unknown>) {
  const firestoreFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      firestoreFields[key] = { integerValue: String(value) };
    } else if (value instanceof Date) {
      firestoreFields[key] = { timestampValue: value.toISOString() };
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  return res.ok;
}

/**
 * Webhook chamado pelo Asaas quando o status de um pagamento muda.
 * Quando o PIX é confirmado (RECEIVED), creditamos o saldo no Firestore.
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
    if (event !== "PAYMENT_RECEIVED" && payment.status !== "RECEIVED" && payment.status !== "CONFIRMED") {
      return NextResponse.json({ received: true });
    }

    // 4. Buscar registro do pagamento no Firestore
    const pixDocRaw = await firestoreGet("pix_payments", payment.id);
    if (!pixDocRaw || !pixDocRaw.fields) {
      console.warn(`Webhook PIX: pagamento ${payment.id} não encontrado no Firestore`);
      return NextResponse.json({ received: true });
    }

    const pixFields = pixDocRaw.fields;
    const currentStatus = pixFields.status?.stringValue;

    // SEGURANÇA: Não processar duas vezes
    if (currentStatus === "CONFIRMED") {
      console.log(`Webhook PIX: pagamento ${payment.id} já processado (duplicata)`);
      return NextResponse.json({ received: true, already_processed: true });
    }

    const userId = pixFields.user_id?.stringValue;
    const amountCents = parseInt(pixFields.amount_cents?.integerValue || "0");
    const userName = pixFields.user_name?.stringValue || "";

    if (!userId || !amountCents) {
      console.error(`Webhook PIX: dados inválidos para ${payment.id}`);
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // 5. Buscar saldo atual do usuário
    const userDocRaw = await firestoreGet("users", userId);
    if (!userDocRaw || !userDocRaw.fields) {
      console.error(`Webhook PIX: usuário ${userId} não existe`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const currentBalance = parseInt(userDocRaw.fields.balance?.integerValue || "0");
    const newBalance = currentBalance + amountCents;

    // 6. Atualizar saldo do usuário
    await firestorePatch("users", userId, {
      balance: newBalance,
    }, ["balance"]);

    // 7. Marcar PIX como confirmado
    await firestorePatch("pix_payments", payment.id, {
      status: "CONFIRMED",
      confirmed_at: new Date(),
      asaas_status: payment.status,
    }, ["status", "confirmed_at", "asaas_status"]);

    // 8. Criar transação para histórico
    const txId = `pix_${payment.id}_${Date.now()}`;
    await firestoreCreate("transactions", txId, {
      type: "recharge",
      amount_cents: amountCents,
      user_id: userId,
      user_name: userName,
      payment_method: "pix",
      pix_payment_id: payment.id,
      status: "completed",
      created_at: new Date(),
    });

    console.log(`Webhook PIX: +${amountCents} centavos creditados ao usuário ${userId}. Novo saldo: ${newBalance}`);
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
