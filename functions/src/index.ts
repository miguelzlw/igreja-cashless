/**
 * Igreja Cashless — Cloud Functions
 * Exporta todas as funções do sistema.
 */

// Auth Triggers
export { onUserCreate } from "./auth/onUserCreate";

// QR Code
export { generateQRCode } from "./qr/generateQRCode";

// Pagamentos
export { processPayment } from "./payment/processPayment";
export { rechargeBalance } from "./payment/rechargeBalance";
export { processRefund } from "./payment/processRefund";
export { creditPixPayment } from "./payment/creditPixPayment";

// PIX
// O fluxo PIX é tratado por API Routes do Next em src/app/api/pix/* (Asaas).
// O webhook delega o crédito atômico do saldo para a Cloud Function creditPixPayment acima.
