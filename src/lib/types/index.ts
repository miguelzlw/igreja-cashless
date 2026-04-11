// ===== Papéis do sistema =====
export type UserRole = "user" | "vendedor" | "gerente_barraca" | "caixa" | "admin";

// ===== Tipos de conta =====
export type AccountType = "user" | "temp";

// ===== Status da conta temporária =====
export type TempAccountStatus = "active" | "redeemed" | "expired";

// ===== Tipos de transação =====
export type TransactionType = "recharge" | "purchase" | "refund" | "transfer";
export type TransactionMethod = "cash" | "pix" | "balance" | "manual";

// ===== Usuário (Firestore: users/{uid}) =====
export interface UserDoc {
  name: string;
  email: string;
  role: UserRole;
  balance: number; // em centavos
  qr_hmac: string;
  stall_id?: string;   // vendedor e gerente_barraca
  stall_name?: string; // cache do nome (para exibição rápida)
  created_at: Date;
  updated_at?: Date;
}

// ===== Conta Temporária / Ficha Física (Firestore: temp_accounts/{id}) =====
export interface TempAccountDoc {
  code: string;        // código curto legível (ex: "0047")
  balance: number;     // em centavos
  qr_hmac: string;
  created_by: string;  // uid do caixa
  created_at: Date;
  status: TempAccountStatus;
}

// ===== Barraca (Firestore: stalls/{id}) =====
export interface StallDoc {
  name: string;
  owner_uid: string;
  created_by: string;
  is_active: boolean;
  total_sales_cents: number;
  created_at: Date;
}

// ===== Produto (Firestore: stalls/{stallId}/products/{productId}) =====
export interface ProductDoc {
  id?: string;         // Preenchido pelo cliente após fetch
  stall_id: string;
  name: string;
  emoji?: string;      // Ex: "🍺", "🌮", "🥤"
  price_cents: number; // em centavos
  stock: number;       // -1 = estoque ilimitado
  active: boolean;
  created_at: Date;
  updated_at?: Date;
}

// ===== Transação (Firestore: transactions/{id}) =====
export interface Transaction {
  id?: string;
  type: TransactionType;
  amount_cents: number;
  user_id: string;
  user_name: string;
  stall_id?: string;
  stall_name?: string;
  operator_id: string;
  operator_name: string;
  items?: CartItem[];
  payment_method?: TransactionMethod;
  pix_payment_id?: string;
  status: "pending" | "completed" | "refunded" | "failed";
  refund_of?: string;
  created_at: Date | unknown; // Aceita Timestamp do Firebase ou JS Date
}

// ===== Carrinho =====
export interface CartItem {
  product_id: string;
  name: string;
  emoji?: string;
  price_cents: number;
  quantity: number;
}

// ===== QR Code Payload =====
export interface QRPayload {
  account_id: string;
  account_type: AccountType;
  hmac: string;
}

// ===== Auth =====
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  userDoc: UserDoc | null;
  loading: boolean;
  error: string | null;
}

// ===== API Responses =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== Configuração do evento =====
export interface EventConfig {
  name: string;
  expires_at: Date;
  max_balance: number;
  min_pix_amount: number;
}

// ===== Helpers de formatação =====
export function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
