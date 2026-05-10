import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const ASAAS_API_URL = "https://api.asaas.com/v3";
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "";
const CREDIT_PIX_URL = process.env.CREDIT_PIX_URL || "";

/**
 * Verifica o Firebase ID Token via REST API
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

  return { uid: data.users[0].localId };
}

/**
 * Lê o documento pix_payments do Firestore autenticado com o ID token do usuário.
 */
async function readPixDoc(paymentId: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/pix_payments/${paymentId}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields || null;
}

/**
 * Consulta o Asaas direto para descobrir o status real do pagamento.
 * Retorna o status em string ("RECEIVED", "CONFIRMED", "PENDING", etc.) ou null em caso de erro.
 */
async function fetchAsaasStatus(paymentId: string): Promise<string | null> {
  if (!ASAAS_API_KEY) return null;
  const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
    headers: { "access_token": ASAAS_API_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status || null;
}

/**
 * Chama a Cloud Function `creditPixPayment` para creditar o saldo do usuário
 * de forma atômica. Mesmo fluxo usado pelo webhook do Asaas.
 */
async function triggerCredit(paymentId: string, asaasStatus: string): Promise<boolean> {
  if (!INTERNAL_WEBHOOK_SECRET || !CREDIT_PIX_URL) {
    console.error("status route: INTERNAL_WEBHOOK_SECRET ou CREDIT_PIX_URL faltando");
    return false;
  }
  const payload = JSON.stringify({ payment_id: paymentId, asaas_status: asaasStatus });
  const signature = crypto.createHmac("sha256", INTERNAL_WEBHOOK_SECRET).update(payload).digest("hex");

  const res = await fetch(CREDIT_PIX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-signature": signature,
    },
    body: payload,
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`status route: creditPixPayment falhou ${res.status} - ${errText}`);
    return false;
  }
  return true;
}

/**
 * Verifica o status de um pagamento PIX.
 * - Lê do Firestore (rápido).
 * - Se ainda PENDING, consulta o Asaas direto. Se já foi pago, dispara a Cloud Function
 *   `creditPixPayment` (atômica + idempotente) para creditar o saldo agora.
 * - Re-lê o Firestore para retornar o status mais recente.
 *
 * Esse fluxo torna o sistema resiliente a falhas de webhook.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Autenticação
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const firebaseUser = await verifyFirebaseToken(token);
    if (!firebaseUser) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // 2. payment_id obrigatório
    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) {
      return NextResponse.json({ error: "payment_id é obrigatório" }, { status: 400 });
    }

    // 3. Lê estado atual no Firestore
    let fields = await readPixDoc(paymentId, token);
    if (!fields) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }
    if (fields.user_id?.stringValue !== firebaseUser.uid) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    let status: string = fields.status?.stringValue || "PENDING";

    // 4. Se ainda PENDING, consulta Asaas direto. Se foi pago, dispara crédito.
    if (status === "PENDING") {
      const asaasStatus = await fetchAsaasStatus(paymentId);
      const isConfirmedAtAsaas =
        asaasStatus === "RECEIVED" ||
        asaasStatus === "CONFIRMED" ||
        asaasStatus === "RECEIVED_IN_CASH";

      if (isConfirmedAtAsaas) {
        const credited = await triggerCredit(paymentId, asaasStatus!);
        if (credited) {
          // Re-lê para pegar o status atualizado pela CF
          fields = await readPixDoc(paymentId, token);
          status = fields?.status?.stringValue || status;
        }
      }
    }

    return NextResponse.json({
      status,
      amount_cents: parseInt(fields?.amount_cents?.integerValue || "0"),
    });
  } catch (error) {
    console.error("Erro ao verificar status PIX:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
