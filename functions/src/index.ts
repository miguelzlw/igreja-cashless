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

// PIX
export { createPixPayment } from "./pix/createPixPayment";
export { handlePixWebhook } from "./pix/handlePixWebhook";
