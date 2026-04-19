import { NextRequest, NextResponse } from "next/server";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

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
 * Verifica o status de um pagamento PIX no Firestore.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const firebaseUser = await verifyFirebaseToken(token);
    if (!firebaseUser) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // 2. Obter payment_id da query
    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) {
      return NextResponse.json({ error: "payment_id é obrigatório" }, { status: 400 });
    }

    // 3. Buscar no Firestore via REST API
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/pix_payments/${paymentId}`;
    const firestoreRes = await fetch(url);

    if (!firestoreRes.ok) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    const docData = await firestoreRes.json();
    const fields = docData.fields;

    if (!fields) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    // SEGURANÇA: Só o dono do pagamento pode verificar
    if (fields.user_id?.stringValue !== firebaseUser.uid) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    return NextResponse.json({
      status: fields.status?.stringValue || "PENDING",
      amount_cents: parseInt(fields.amount_cents?.integerValue || "0"),
    });
  } catch (error) {
    console.error("Erro ao verificar status PIX:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
