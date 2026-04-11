// Utilitários de formatação — pt-BR

export function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export function parseCentavos(reais: string): number {
  // Remove tudo que não é dígito ou vírgula/ponto
  const clean = reais.replace(/[^\d,.]/g, "").replace(",", ".");
  const value = parseFloat(clean);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function centavosToReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export function truncateName(name: string, maxLength = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + "…";
}
