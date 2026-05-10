import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || "";
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "";
const CREDIT_PIX_URL = process.env.CREDIT_PIX_URL || "";

/**
 * Comparação string em tempo constante (evita timing attacks).
 */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Webhook chamado pelo Asaas quando o status de um pagamento muda.
 * Apenas autentica o pedido e delega o crédito atômico para a Cloud Function
 * `creditPixPayment` (ver functions/src/payment/creditPixPayment.ts).
 */
export async function POST(request: NextRequest) {
  try {
    if (!ASAAS_WEBHOOK_TOKEN || !INTERNAL_WEBHOOK_SECRET || !CREDIT_PIX_URL) {
      console.error("Webhook PIX: variáveis de ambiente faltando (ASAAS_WEBHOOK_TOKEN, INTERNAL_WEBHOOK_SECRET, CREDIT_PIX_URL)");
      return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
    }

    // 1. Verificar token do Asaas (timing-safe, só via header)
    const token = request.headers.get("asaas-access-token");
    if (!token || !timingSafeEqualString(token, ASAAS_WEBHOOK_TOKEN)) {
      console.warn("Webhook PIX: token inválido");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parsear corpo
    const body = await request.json();
    const event = body.event;
    const payment = body.payment;

    if (!payment?.id) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    console.log(`Webhook PIX: evento=${event}, paymentId=${payment.id}, status=${payment.status}`);

    // 3. Só processar quando o pagamento for confirmado
    const isConfirmed =
      event === "PAYMENT_RECEIVED" ||
      payment.status === "RECEIVED" ||
      payment.status === "CONFIRMED";

    if (!isConfirmed) {
      return NextResponse.json({ received: true });
    }

    // 4. Delegar crédito atômico para a Cloud Function
    const cfPayload = {
      payment_id: payment.id,
      asaas_status: payment.status,
    };
    const cfBody = JSON.stringify(cfPayload);
    const cfSignature = crypto
      .createHmac("sha256", INTERNAL_WEBHOOK_SECRET)
      .update(cfBody)
      .digest("hex");

    const cfRes = await fetch(CREDIT_PIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-signature": cfSignature,
      },
      body: cfBody,
    });

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      console.error(`Webhook PIX: creditPixPayment falhou ${cfRes.status} - ${errText}`);
      // Retorna 200 para Asaas não reenviar agressivamente; erros vão para o log do servidor.
      return NextResponse.json({ received: true, deferred: true });
    }

    const cfResult = await cfRes.json();
    console.log(`Webhook PIX: ${payment.id} processado`, cfResult);
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
