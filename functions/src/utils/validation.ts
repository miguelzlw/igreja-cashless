import { Errors } from "./errors";
import type { UserRole } from "./types";

/**
 * Valida que o valor é um inteiro positivo em centavos
 */
export function validateAmountCents(value: unknown, fieldName = "valor"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw Errors.INVALID_ARGUMENT(fieldName, "deve ser um número inteiro positivo em centavos");
  }
  return value;
}

/**
 * Valida string não-vazia
 */
export function validateString(value: unknown, fieldName: string, minLength = 1, maxLength = 500): string {
  if (typeof value !== "string" || value.trim().length < minLength || value.length > maxLength) {
    throw Errors.INVALID_ARGUMENT(fieldName, `deve ser um texto entre ${minLength} e ${maxLength} caracteres`);
  }
  return value.trim();
}

/**
 * Valida e-mail básico
 */
export function validateEmail(value: unknown): string {
  const email = validateString(value, "email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw Errors.INVALID_ARGUMENT("email", "formato inválido");
  }
  return email.toLowerCase();
}

/**
 * Valida role do sistema
 */
export function validateRole(value: unknown): UserRole {
  const validRoles: UserRole[] = ["admin", "caixa", "gerente_barraca", "vendedor", "user"];
  if (typeof value !== "string" || !validRoles.includes(value as UserRole)) {
    throw Errors.INVALID_ARGUMENT("role", `deve ser um dos valores: ${validRoles.join(", ")}`);
  }
  return value as UserRole;
}

/**
 * Valida UID do Firebase
 */
export function validateUid(value: unknown, fieldName = "uid"): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw Errors.INVALID_ARGUMENT(fieldName, "UID inválido");
  }
  return value;
}

/**
 * Valida array de itens de venda
 */
export function validateSaleItems(
  items: unknown
): Array<{ product_id: string; name: string; quantity: number; unit_price_cents: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw Errors.INVALID_ARGUMENT("items", "deve conter pelo menos um item");
  }

  if (items.length > 50) {
    throw Errors.INVALID_ARGUMENT("items", "máximo de 50 itens por venda");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw Errors.INVALID_ARGUMENT(`items[${index}]`, "item inválido");
    }

    return {
      product_id: validateString(item.product_id, `items[${index}].product_id`),
      name: validateString(item.name, `items[${index}].name`, 1, 100),
      quantity: validateAmountCents(item.quantity, `items[${index}].quantity`),
      unit_price_cents: validateAmountCents(item.unit_price_cents, `items[${index}].unit_price_cents`),
    };
  });
}
