"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface FichaData {
  id: string;
  code: string;
}

function FichasPrinter() {
  const searchParams = useSearchParams();
  const [fichas, setFichas] = useState<FichaData[]>([]);

  useEffect(() => {
    try {
      const data = searchParams.get("data");
      if (data) {
        setFichas(JSON.parse(decodeURIComponent(data)));
      }
    } catch {
      console.error("Dados inválidos");
    }
  }, [searchParams]);

  useEffect(() => {
    if (fichas.length > 0) {
      setTimeout(() => window.print(), 800);
    }
  }, [fichas]);

  if (fichas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Carregando fichas...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { margin: 0; }
          .no-print { display: none !important; }
          .ficha { break-inside: avoid; }
        }
        body { background: white; font-family: Arial, sans-serif; }
        .fichas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          padding: 8px;
        }
        .ficha {
          border: 2px dashed #7c3aed;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          height: 160px;
          justify-content: center;
        }
        .ficha-event { font-size: 11px; color: #6b7280; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        .ficha-title { font-size: 14px; font-weight: 800; color: #1f2937; }
        .ficha-code { font-size: 20px; font-weight: 900; color: #7c3aed; letter-spacing: 0.1em; font-family: monospace; }
        .ficha-qr { width: 80px; height: 80px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-center: center; font-size: 10px; color: #9ca3af; padding: 4px; }
        .ficha-hint { font-size: 9px; color: #9ca3af; }
        .print-btn { position: fixed; bottom: 20px; right: 20px; background: #7c3aed; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div className="no-print" style={{ background: '#f9fafb', padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 18, color: '#1f2937' }}>
            {fichas.length} Fichas Geradas
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Clique em "Imprimir" para imprimir em folhas A4 (6 por folha)
          </p>
        </div>
        <button onClick={() => window.print()} className="print-btn">
          🖨️ Imprimir
        </button>
      </div>

      <div className="fichas-grid">
        {fichas.map(ficha => (
          <div key={ficha.id} className="ficha">
            <p className="ficha-event">🎉 Festa de São João</p>
            <p className="ficha-title">FICHA CASHLESS</p>
            <p className="ficha-code">#{ficha.code}</p>
            <div className="ficha-qr">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(`${ficha.id}:temp_${ficha.id}`)}`}
                alt={`QR ${ficha.code}`}
                width={72}
                height={72}
                style={{ borderRadius: 4 }}
              />
            </div>
            <p className="ficha-hint">Apresente ao caixa para recarregar</p>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PrintFichasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500">Carregando visualização...</div>}>
      <FichasPrinter />
    </Suspense>
  );
}


