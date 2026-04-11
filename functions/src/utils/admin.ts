import * as admin from "firebase-admin";

// Inicializa o Firebase Admin SDK
// Em Cloud Functions, o app é inicializado automaticamente com credenciais do projeto
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const authAdmin = admin.auth();

// Região padrão para todas as functions
export const REGION = "southamerica-east1";

// Configurações do evento
export const EVENT_CONFIG = {
  /** Valor mínimo de recarga em centavos (R$ 5,00) */
  MIN_RECHARGE_CENTS: 500,
  /** Valor máximo de recarga em centavos (R$ 500,00) */
  MAX_RECHARGE_CENTS: 50000,
  /** Tempo de expiração do pagamento PIX em minutos */
  PIX_EXPIRATION_MINUTES: 30,
  /** Quantidade máxima de operações por minuto por IP */
  RATE_LIMIT_PER_MINUTE: 20,
} as const;
