/**
 * Tipos compartilhados entre Cloud Functions — espelha os tipos do frontend
 */
export type UserRole = "admin" | "caixa" | "gerente_barraca" | "vendedor" | "user";

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  balance: number; // centavos
  qr_hmac: string;
  stall_id?: string;
  is_temp: boolean;
  created_at: FirebaseFirestore.Timestamp;
  updated_at: FirebaseFirestore.Timestamp;
}

export interface SaleItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Transaction {
  id?: string;
  type: "recharge" | "purchase" | "refund" | "transfer";
  amount_cents: number;
  user_id: string;
  user_name: string;
  stall_id?: string;
  stall_name?: string;
  operator_id: string;
  operator_name: string;
  items?: SaleItem[];
  payment_method?: "pix" | "manual" | "balance";
  pix_payment_id?: string;
  status: "pending" | "completed" | "refunded" | "failed";
  refund_of?: string;
  created_at: FirebaseFirestore.Timestamp;
}

export interface Stall {
  id?: string;
  name: string;
  owner_id: string;
  owner_name: string;
  products: Product[];
  is_active: boolean;
  total_sales_cents: number;
  created_at: FirebaseFirestore.Timestamp;
}

export interface Product {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  category?: string;
}

export interface PixPayment {
  id?: string;
  user_id: string;
  amount_cents: number;
  mp_payment_id?: string;
  mp_qr_code?: string;
  mp_qr_code_base64?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: FirebaseFirestore.Timestamp;
  expires_at: FirebaseFirestore.Timestamp;
}
