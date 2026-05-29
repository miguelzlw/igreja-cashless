import { formatCurrency } from "@/lib/utils/formatters";
import { MAX_BALANCE_CENTS } from "@/lib/config/limits";
import { QrCode } from "lucide-react";

interface UserBalanceCardProps {
  balanceCents: number;
  onOpenQR: () => void;
}

/**
 * Cartão de saldo principal — visual "Terra" do Stitch:
 * gradiente verde-floresta → ocre dourado, texto branco grande e
 * botão "Ver meu QR Code" em pílula cream destacando dentro do gradiente.
 */
export default function UserBalanceCard({ balanceCents, onOpenQR }: UserBalanceCardProps) {
  const percentOfLimit = Math.min(100, Math.round((balanceCents / MAX_BALANCE_CENTS) * 100));
  const nearLimit = balanceCents >= MAX_BALANCE_CENTS * 0.8;

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-terra-glow animate-fade-in">
      {/* Gradiente verde-floresta → ocre (identidade Terra) */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-600 to-tertiary" />

      {/* Brilho decorativo (camadas pra dar profundidade) */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-tertiary-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 px-6 pt-7 pb-6 text-center text-white">
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
          Saldo Disponível
        </p>

        {/* Valor — grande, com Literata pra ter personalidade */}
        <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight mb-5 leading-none">
          {formatCurrency(balanceCents)}
        </h2>

        {/* Barra de limite — só aparece quando perto do teto */}
        {nearLimit && (
          <div className="mb-5 space-y-1.5 text-white/90">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
              <span>Perto do limite</span>
              <span>{formatCurrency(MAX_BALANCE_CENTS)}</span>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${percentOfLimit}%` }}
              />
            </div>
          </div>
        )}

        {/* Botão QR — pílula cream contrasting com o gradiente */}
        <button
          onClick={onOpenQR}
          className="w-full inline-flex items-center justify-center gap-2
                     bg-[hsl(var(--surface))] text-primary font-bold
                     px-6 py-3.5 rounded-2xl shadow-lg
                     hover:bg-white active:scale-[0.98] transition-all"
        >
          <QrCode className="w-5 h-5" />
          Ver meu QR Code
        </button>
      </div>
    </div>
  );
}
