import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;
const ASAAS_API_URL = "https://api.asaas.com/v3";

// Valores mínimo e máximo em centavos
const MIN_PIX_CENTS = 500;    // R$ 5,00
const MAX_PIX_CENTS = 50000;  // R$ 500,00

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação via token do Firebase
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

    const userId = decodedToken.uid;

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

    // 3. Buscar dados do usuário no Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // 4. Criar cobrança PIX no Asaas
    const amountBRL = (amountCents / 100).toFixed(2);

    const asaasResponse = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: undefined, // Vamos criar inline
        billingType: "PIX",
        value: parseFloat(amountBRL),
        description: `Recarga Cashless - ${userData.name}`,
        externalReference: `pix_${userId}_${Date.now()}`,
        dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString().split("T")[0], // 30 min
      }),
    });

    // Se não tiver customer, precisamos criar primeiro
    if (!asaasResponse.ok) {
      // Tenta criar o customer primeiro
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: userData.name || "Participante",
          email: userData.email || undefined,
          externalReference: userId,
          notificationDisabled: true,
        }),
      });

      if (!customerRes.ok) {
        const err = await customerRes.json();
        console.error("Erro ao criar customer no Asaas:", err);
        return NextResponse.json({ error: "Erro ao preparar pagamento" }, { status: 500 });
      }

      const customerData = await customerRes.json();

      // Agora cria a cobrança com o customer
      const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          customer: customerData.id,
          billingType: "PIX",
          value: parseFloat(amountBRL),
          description: `Recarga Cashless - ${userData.name}`,
          externalReference: `pix_${userId}_${Date.now()}`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }),
      });

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        console.error("Erro ao criar cobrança:", err);
        return NextResponse.json({ error: "Erro ao gerar PIX" }, { status: 500 });
      }

      const paymentData = await paymentRes.json();

      // Buscar QR Code do PIX
      const qrRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "access_token": ASAAS_API_KEY },
      });

      if (!qrRes.ok) {
        return NextResponse.json({ error: "Erro ao gerar QR Code PIX" }, { status: 500 });
      }

      const qrData = await qrRes.json();

      // 5. Salvar pendência no Firestore
      await adminDb.collection("pix_payments").doc(paymentData.id).set({
        user_id: userId,
        user_name: userData.name,
        asaas_payment_id: paymentData.id,
        amount_cents: amountCents,
        status: "PENDING",
        created_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      });

      return NextResponse.json({
        success: true,
        payment_id: paymentData.id,
        qr_code: qrData.encodedImage, // Base64 da imagem do QR
        copy_paste: qrData.payload,    // Código copia e cola
        amount_cents: amountCents,
        expires_in_minutes: 30,
      });
    }

    // Caso a primeira tentativa tenha funcionado (raro na primeira vez)
    const paymentData = await asaasResponse.json();
    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const qrData = await qrRes.json();

    await adminDb.collection("pix_payments").doc(paymentData.id).set({
      user_id: userId,
      user_name: userData.name,
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
