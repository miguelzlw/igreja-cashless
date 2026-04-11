"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Copy, Camera, Loader2 } from "lucide-react";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  pauseOnScan?: boolean;
}

type CameraStatus = 'pending' | 'granted' | 'denied';

export default function QRScanner({ onScanSuccess, onScanError, pauseOnScan = true }: QRScannerProps) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('pending');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-reader";

  useEffect(() => {
    // Inicializar o scanner apenas uma vez
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(regionId);
    }

    const scanner = scannerRef.current;

    const startScanning = async () => {
      try {
        const hasCameras = await Html5Qrcode.getCameras();
        if (hasCameras && hasCameras.length > 0) {
          setCameraStatus('granted');
          
          await scanner.start(
            { facingMode: "environment" }, // Preferir câmera traseira
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (pauseOnScan) {
                scanner.pause();
                setTimeout(() => {
                  onScanSuccess(decodedText);
                  scanner.resume();
                }, 500);
              } else {
                onScanSuccess(decodedText);
              }
            },
            (errorMessage) => {
              if (onScanError) onScanError(errorMessage);
            }
          );
          setIsScanning(true);
        } else {
          setCameraStatus('denied');
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        setCameraStatus('denied');
      }
    };

    startScanning();

    // Limpeza ao desmontar
    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(console.error);
        setIsScanning(false);
      }
    };
  }, [onScanSuccess, onScanError, pauseOnScan]);

  if (cameraStatus === 'denied') {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4 text-danger">
          <Camera className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[hsl(var(--text-primary))] mb-2">
          Permissão Negada
        </h3>
        <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">
          Não conseguimos acessar sua câmera. Verifique as permissões do seu navegador para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl glass-card flex flex-col">
      {!isScanning && cameraStatus === 'pending' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="font-medium animate-pulse">Iniciando câmera...</p>
        </div>
      )}
      
      {/* Container que a biblioteca html5-qrcode injeta o vídeo */}
      <div id={regionId} className="w-full relative bg-black/10 min-h-[300px]">
        {/* Overlay scanning guides added by html5-qrcode dynamically */}
      </div>

      <div className="p-4 bg-[hsl(var(--card))]/80 backdrop-blur border-t border-[hsl(var(--border))]/30 flex justify-between items-center z-20">
        <span className="text-sm font-medium text-[hsl(var(--text-secondary))] flex items-center gap-2">
          <Copy className="w-4 h-4" />
          Aponte para o QR Code do cliente
        </span>
      </div>
    </div>
  );
}
