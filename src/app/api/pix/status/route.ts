import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

/**
 * Verifica o status de um pagamento PIX no Firestore.
 * O frontend faz polling neste endpoint para saber se foi confirmado.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // 2. Obter payment_id da query
    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (!paymentId) {
      return NextResponse.json({ error: "payment_id é obrigatório" }, { status: 400 });
    }

    // 3. Buscar no Firestore
    const pixDoc = await adminDb.collection("pix_payments").doc(paymentId).get();
    if (!pixDoc.exists) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    const pixData = pixDoc.data()!;

    // SEGURANÇA: Só o dono do pagamento pode verificar
    if (pixData.user_id !== decodedToken.uid) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    return NextResponse.json({
      status: pixData.status, // "PENDING" ou "CONFIRMED"
      amount_cents: pixData.amount_cents,
    });
  } catch (error) {
    console.error("Erro ao verificar status PIX:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
