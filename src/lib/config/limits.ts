/**
 * Limites e regras de negócio do sistema cashless.
 *
 * Centralizado aqui para que cliente, API routes e Cloud Functions
 * usem o mesmo valor — evitando "configuração esparramada" pelo código.
 */

/** Saldo máximo que um participante pode ter na conta. */
export const MAX_BALANCE_CENTS = 10_000; // R$ 100,00

/** Valor mínimo de uma recarga PIX (limite do Asaas). */
export const MIN_PIX_CENTS = 500; // R$ 5,00

/** Valor máximo de uma única recarga PIX. */
export const MAX_PIX_CENTS = 10_000; // R$ 100,00 (igual ao teto da conta)

/**
 * Formata centavos como BRL para mensagens ao usuário.
 * (Versão server-friendly que não depende de Intl em runtimes restritos.)
 */
export function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
