import { HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https";

/**
 * Cria um HttpsError tipado para usar em callable functions.
 * Todas as mensagens são em português para o frontend.
 */
export function createError(
  code: FunctionsErrorCode,
  message: string,
  details?: unknown
): HttpsError {
  return new HttpsError(code, message, details);
}

// Erros pré-definidos
export const Errors = {
  UNAUTHENTICATED: () =>
    createError("unauthenticated", "Você precisa estar logado para realizar esta operação."),

  PERMISSION_DENIED: (action = "realizar esta operação") =>
    createError("permission-denied", `Você não tem permissão para ${action}.`),

  NOT_FOUND: (resource = "Recurso") =>
    createError("not-found", `${resource} não encontrado(a).`),

  INVALID_ARGUMENT: (field: string, reason: string) =>
    createError("invalid-argument", `Campo "${field}" inválido: ${reason}.`),

  ALREADY_EXISTS: (resource = "Recurso") =>
    createError("already-exists", `${resource} já existe.`),

  INSUFFICIENT_BALANCE: (required: number, available: number) =>
    createError(
      "failed-precondition",
      `Saldo insuficiente. Necessário: R$ ${(required / 100).toFixed(2)}, disponível: R$ ${(available / 100).toFixed(2)}.`
    ),

  RATE_LIMITED: () =>
    createError("resource-exhausted", "Muitas tentativas. Aguarde um momento e tente novamente."),

  INTERNAL: (context?: string) =>
    createError("internal", `Erro interno${context ? `: ${context}` : ". Tente novamente mais tarde."}`),

  EVENT_CLOSED: () =>
    createError("failed-precondition", "O evento está encerrado. Não é possível realizar operações."),
} as const;
