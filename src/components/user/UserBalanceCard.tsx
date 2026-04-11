import { formatCurrency } from "@/lib/utils/formatters";
import { Wallet, QrCode } from "lucide-react";

interface UserBalanceCardProps {
  balanceCents: number;
  onOpenQR: () => void;
}

export default function UserBalanceCard({ balanceCents, onOpenQR }: UserBalanceCardProps) {
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
        <h2 className="text-4xl font-bold text-[hsl(var(--text-primary))] mb-6 tracking-tight">
          {formatCurrency(balanceCents)}
        </h2>

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
