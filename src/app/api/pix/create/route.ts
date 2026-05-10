import { NextRequest, NextResponse } from "next/server";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;
const ASAAS_API_URL = "https://api.asaas.com/v3";
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

// Valores mínimo e máximo em centavos
const MIN_PIX_CENTS = 500;    // R$ 5,00 (mínimo exigido pelo Asaas para cobranças PIX)
const MAX_PIX_CENTS = 50000;  // R$ 500,00

// Cache simples para evitar criar o mesmo customer várias vezes
const customerCache = new Map<string, string>();

// ─── Rate limiter simples por usuário (em memória) ─────────────────────
// Protege contra abuso/DoS na rota: usuário autenticado não pode disparar
// mais de N criações de PIX em uma janela de tempo. Estado vive no processo
// (perdido em cold start), o que é OK pra esse caso de uso — em ataques
// distribuídos o Asaas rate-limita do lado dele.
const RATE_LIMIT_MAX_REQUESTS = 5;        // 5 pedidos
const RATE_LIMIT_WINDOW_MS = 60_000;       // por minuto
const rateLimitBuckets = new Map<string, number[]>();

function checkAndConsumeRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = (rateLimitBuckets.get(userId) || []).filter(t => t > cutoff);

  if (bucket.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = bucket[0];
    const retryAfterSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  bucket.push(now);
  rateLimitBuckets.set(userId, bucket);

  // Limpeza ocasional: se o map ficar muito grande, remove buckets vazios.
  if (rateLimitBuckets.size > 1000) {
    for (const [k, v] of rateLimitBuckets) {
      const filtered = v.filter(t => t > cutoff);
      if (filtered.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, filtered);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

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
 * Escreve um documento no Firestore via REST API autenticando com o ID token do usuário.
 * As regras do Firestore validam que o usuário só pode criar pix_payment com seu próprio user_id.
 */
async function firestoreSet(
  collection: string,
  docId: string,
  fields: Record<string, unknown>,
  idToken: string,
) {
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
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`firestoreSet falhou: ${res.status} - ${errBody}`);
  }

  return res.ok;
}

/**
 * Busca ou cria um customer no Asaas para o usuário.
 * Se já existir mas estiver sem CPF/CNPJ, atualiza com o que foi passado.
 */
async function getOrCreateAsaasCustomer(
  userId: string,
  name: string,
  email: string,
  cpfCnpj: string,
): Promise<string | null> {
  // Verifica cache em memória (chave inclui CPF para invalidar quando muda)
  const cacheKey = `${userId}:${cpfCnpj}`;
  if (customerCache.has(cacheKey)) {
    return customerCache.get(cacheKey)!;
  }

  // Tenta buscar customer existente pelo externalReference
  const searchRes = await fetch(
    `${ASAAS_API_URL}/customers?externalReference=${userId}`,
    { headers: { "access_token": ASAAS_API_KEY } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      const existing = searchData.data[0];
      // Se o customer existe sem CPF (ou com CPF diferente), atualiza
      if (!existing.cpfCnpj || existing.cpfCnpj.replace(/\D/g, "") !== cpfCnpj) {
        const updateRes = await fetch(`${ASAAS_API_URL}/customers/${existing.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify({ cpfCnpj, name: name || existing.name, email: email || existing.email }),
        });
        if (!updateRes.ok) {
          const err = await updateRes.json();
          console.error("Erro ao atualizar customer no Asaas:", JSON.stringify(err));
          return null;
        }
      }
      customerCache.set(cacheKey, existing.id);
      return existing.id;
    }
  }

  // Cria novo customer já com CPF
  const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_API_KEY,
    },
    body: JSON.stringify({
      name: name || "Participante",
      email: email || undefined,
      cpfCnpj,
      externalReference: userId,
      notificationDisabled: true,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error("Erro ao criar customer no Asaas:", JSON.stringify(err));
    return null;
  }

  const customerData = await createRes.json();
  customerCache.set(cacheKey, customerData.id);
  return customerData.id;
}

/**
 * Atualiza apenas o campo `cpf` no documento do usuário no Firestore.
 * Usa PATCH com updateMask para não tocar em outros campos (balance, role).
 */
async function saveCpfToUserDoc(userId: string, cpf: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=cpf&updateMask.fieldPaths=updated_at`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        cpf: { stringValue: cpf },
        updated_at: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error(`saveCpfToUserDoc falhou: ${res.status} - ${errBody}`);
  }
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

    // 1a. Rate limit por usuário (5 PIX/min). Protege Asaas contra abuso.
    const rl = checkAndConsumeRateLimit(userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Aguarde ${rl.retryAfterSec}s e tente novamente.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // 2. Validar dados da requisição
    const body = await request.json();
    const amountCents = Math.round(Number(body.amount_cents));
    const cpfCnpj = String(body.cpf_cnpj || "").replace(/\D/g, "");

    if (!amountCents || isNaN(amountCents)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    if (amountCents < MIN_PIX_CENTS) {
      return NextResponse.json({ error: `Valor mínimo: R$ ${(MIN_PIX_CENTS / 100).toFixed(2)}` }, { status: 400 });
    }

    if (amountCents > MAX_PIX_CENTS) {
      return NextResponse.json({ error: `Valor máximo: R$ ${(MAX_PIX_CENTS / 100).toFixed(2)}` }, { status: 400 });
    }

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return NextResponse.json({ error: "CPF ou CNPJ inválido. Informe 11 dígitos (CPF) ou 14 (CNPJ)." }, { status: 400 });
    }

    // 3. Buscar ou criar customer no Asaas (já com CPF)
    const customerId = await getOrCreateAsaasCustomer(
      userId,
      firebaseUser.name,
      firebaseUser.email,
      cpfCnpj,
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

    // 6. Salvar pendência no Firestore (autenticado com o ID token do usuário)
    const saved = await firestoreSet("pix_payments", paymentData.id, {
      user_id: userId,
      user_name: firebaseUser.name,
      user_email: firebaseUser.email,
      asaas_payment_id: paymentData.id,
      amount_cents: amountCents,
      status: "PENDING",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    }, token);

    if (!saved) {
      return NextResponse.json({ error: "Erro ao registrar pagamento. Tente novamente." }, { status: 500 });
    }

    // 7. Persistir o CPF/CNPJ no userDoc (best-effort — não bloqueia o retorno)
    saveCpfToUserDoc(userId, cpfCnpj, token).catch(() => {});

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
