import { formatCurrency } from "@/lib/utils/formatters";
import { MAX_BALANCE_CENTS } from "@/lib/config/limits";
import { Wallet, QrCode } from "lucide-react";

interface UserBalanceCardProps {
  balanceCents: number;
  onOpenQR: () => void;
}

export default function UserBalanceCard({ balanceCents, onOpenQR }: UserBalanceCardProps) {
  const percentOfLimit = Math.min(100, Math.round((balanceCents / MAX_BALANCE_CENTS) * 100));
  const nearLimit = balanceCents >= MAX_BALANCE_CENTS * 0.8;

  return (
    <div className="glass-card overflow-hidden relative mb-8 animate-fade-in group">
      {/* Decorative gradient blur inside card */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-colors" />

      <div className="relative z-10 p-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Wallet className="w-6 h-6 text-primary" />
        </div>

        <p className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-1 uppercase tracking-wide">
          Seu Saldo
        </p>
        <h2 className="text-4xl font-bold text-[hsl(var(--text-primary))] mb-3 tracking-tight">
          {formatCurrency(balanceCents)}
        </h2>

        {/* Indicador de limite */}
        <div className="w-full mb-5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[hsl(var(--text-muted))] font-medium uppercase tracking-wide">
            <span>Limite máximo</span>
            <span>{formatCurrency(MAX_BALANCE_CENTS)}</span>
          </div>
          <div className="w-full h-1.5 bg-[hsl(var(--bg))] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${nearLimit ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${percentOfLimit}%` }}
            />
          </div>
        </div>

        <button
          onClick={onOpenQR}
          className="btn-primary w-full shadow-lg shadow-primary/25 flex items-center justify-center gap-2 group-hover:scale-[1.02] transition-transform"
        >
          <QrCode className="w-5 h-5" />
          Pagar com QR Code
        </button>
      </div>
    </div>
  );
}
