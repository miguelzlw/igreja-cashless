import { NextRequest, NextResponse } from "next/server";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;
const ASAAS_API_URL = "https://api.asaas.com/v3";
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

// Valores mínimo e máximo em centavos
const MIN_PIX_CENTS = 500;    // R$ 5,00
const MAX_PIX_CENTS = 50000;  // R$ 500,00

// Cache simples para evitar criar o mesmo customer várias vezes
const customerCache = new Map<string, string>();

/**
 * Verifica o Firebase ID Token via REST API (sem necessidade de Admin SDK)
 */
async function verifyFirebaseToken(idToken: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.users || data.users.length === 0) return null;

  return {
    uid: data.users[0].localId,
    email: data.users[0].email,
    name: data.users[0].displayName || data.users[0].email?.split("@")[0] || "Participante",
  };
}

/**
 * Lê um documento do Firestore via REST API
 */
async function firestoreGet(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields;
}

/**
 * Escreve um documento no Firestore via REST API
 */
async function firestoreSet(collection: string, docId: string, fields: Record<string, unknown>) {
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

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  return res.ok;
}

/**
 * Busca ou cria um customer no Asaas para o usuário
 */
async function getOrCreateAsaasCustomer(userId: string, name: string, email: string): Promise<string | null> {
  // Verifica cache em memória
  if (customerCache.has(userId)) {
    return customerCache.get(userId)!;
  }

  // Tenta buscar customer existente pelo externalReference
  const searchRes = await fetch(
    `${ASAAS_API_URL}/customers?externalReference=${userId}`,
    { headers: { "access_token": ASAAS_API_KEY } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      const customerId = searchData.data[0].id;
      customerCache.set(userId, customerId);
      return customerId;
    }
  }

  // Cria novo customer
  const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_API_KEY,
    },
    body: JSON.stringify({
      name: name || "Participante",
      email: email || undefined,
      externalReference: userId,
      notificationDisabled: true,
      // CPF não é obrigatório para criar customer, só para algumas operações
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error("Erro ao criar customer no Asaas:", JSON.stringify(err));
    return null;
  }

  const customerData = await createRes.json();
  customerCache.set(userId, customerData.id);
  return customerData.id;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação via token do Firebase
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const firebaseUser = await verifyFirebaseToken(token);
    if (!firebaseUser) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const userId = firebaseUser.uid;

    // 2. Validar dados da requisição
    const body = await request.json();
    const amountCents = Math.round(Number(body.amount_cents));

    if (!amountCents || isNaN(amountCents)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    if (amountCents < MIN_PIX_CENTS) {
      return NextResponse.json({ error: `Valor mínimo: R$ ${(MIN_PIX_CENTS / 100).toFixed(2)}` }, { status: 400 });
    }

    if (amountCents > MAX_PIX_CENTS) {
      return NextResponse.json({ error: `Valor máximo: R$ ${(MAX_PIX_CENTS / 100).toFixed(2)}` }, { status: 400 });
    }

    // 3. Buscar ou criar customer no Asaas
    const customerId = await getOrCreateAsaasCustomer(
      userId,
      firebaseUser.name,
      firebaseUser.email
    );

    if (!customerId) {
      return NextResponse.json({ error: "Erro ao preparar pagamento. Tente novamente." }, { status: 500 });
    }

    // 4. Criar cobrança PIX no Asaas
    const amountBRL = (amountCents / 100).toFixed(2);
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: parseFloat(amountBRL),
        description: `Recarga Cashless - ${firebaseUser.name}`,
        externalReference: `pix_${userId}_${Date.now()}`,
        dueDate,
      }),
    });

    if (!paymentRes.ok) {
      const err = await paymentRes.json();
      console.error("Erro ao criar cobrança PIX:", JSON.stringify(err));
      return NextResponse.json({ error: "Erro ao gerar cobrança PIX" }, { status: 500 });
    }

    const paymentData = await paymentRes.json();

    // 5. Buscar QR Code do PIX
    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });

    if (!qrRes.ok) {
      const err = await qrRes.json();
      console.error("Erro ao gerar QR Code:", JSON.stringify(err));
      return NextResponse.json({ error: "Erro ao gerar QR Code PIX" }, { status: 500 });
    }

    const qrData = await qrRes.json();

    // 6. Salvar pendência no Firestore (via REST API)
    await firestoreSet("pix_payments", paymentData.id, {
      user_id: userId,
      user_name: firebaseUser.name,
      user_email: firebaseUser.email,
      asaas_payment_id: paymentData.id,
      amount_cents: amountCents,
      status: "PENDING",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      payment_id: paymentData.id,
      qr_code: qrData.encodedImage,
      copy_paste: qrData.payload,
      amount_cents: amountCents,
      expires_in_minutes: 30,
    });
  } catch (error) {
    console.error("Erro interno ao gerar PIX:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
