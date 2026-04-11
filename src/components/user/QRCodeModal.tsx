import { useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { X, ShieldCheck } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrPayload: string;
  userName: string;
}

export default function QRCodeModal({ isOpen, onClose, qrPayload, userName }: QRCodeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Previne rolagem do fundo
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[10vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal - Bottom Sheet feel on mobile, centered on large screens */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-sm glass-card border border-[hsl(var(--border))]/50 flex flex-col pt-12 pb-8 px-6 animate-slide-up shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-primary-300 to-primary" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[hsl(var(--bg))]/50 hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-1">
            Seu QR Code
          </h3>
          <p className="text-sm text-[hsl(var(--text-secondary))]">
            Apresente ao vendedor da barraca
          </p>
        </div>

        {/* QR Code container - White background for contrast */}
        <div className="mx-auto bg-white p-6 rounded-2xl shadow-inner mb-6">
          <QRCode 
            value={qrPayload}
            size={220}
            level="H" 
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-[hsl(var(--text-muted))]">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Seguro • Assinatura Digital</span>
        </div>
      </div>
    </div>
  );
}
