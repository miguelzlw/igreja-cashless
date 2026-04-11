import { onCall } from "firebase-functions/v2/https";
import { REGION } from "../utils/admin";
import { Errors } from "../utils/errors";
import { generateQRPayload } from "../utils/hmac";

/**
 * Callable Function: Gera o payload do QR Code para o usuário logado.
 * O payload contém uid:hmac e pode ser codificado em QR no frontend.
 */
export const generateQRCode = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    if (!request.auth?.uid) {
      throw Errors.UNAUTHENTICATED();
    }

    const payload = generateQRPayload(request.auth.uid);

    return {
      success: true,
      qr_payload: payload,
    };
  }
);
