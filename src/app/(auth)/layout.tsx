import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta no sistema cashless da Festa de São João.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
