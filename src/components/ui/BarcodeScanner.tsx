import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RotateCcw } from 'lucide-react';
import { playScannerBeep } from '../../lib/sounds';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const qrCodeInstance = useRef<Html5Qrcode | null>(null);
  const hasScannedByRef = useRef(false);

  useEffect(() => {
    const startScanner = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          try {
            await CapCamera.requestPermissions({ permissions: ['camera'] });
          } catch (permErr) {
            console.warn("Failed to request native camera permission:", permErr);
          }
        } else {
          // Request web camera permission first to unlock access in iframes
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
              tempStream.getTracks().forEach(track => track.stop());
            } catch (permErr) {
              console.warn("Pre-permission prompt failed or was denied:", permErr);
            }
          }
        }
        qrCodeInstance.current = new Html5Qrcode("reader");
        
        await qrCodeInstance.current.start(
          { facingMode: "environment" }, // Prefer rear camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (hasScannedByRef.current) return;
            hasScannedByRef.current = true;

            try {
              playScannerBeep();
            } catch (e) {
              console.warn("Error playing beep:", e);
            }

            // Immediately stop camera scan to freeze/release and prevent double calls
            if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
              try {
                await qrCodeInstance.current.stop();
                qrCodeInstance.current.clear();
              } catch (stopErr) {
                console.warn("Error stopping inside scanner callback:", stopErr);
              }
            }

            onScan(decodedText);
            onClose();
          },
          (errorMessage) => {
            // Passive scanning errors
          }
        );
        setIsReady(true);
      } catch (err: any) {
        console.error("Scanner Error:", err);
        setError("فشل تشغيل الكاميرا. يرجى التأكد من منح الإذن.");
      }
    };

    startScanner();

    return () => {
      if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
        qrCodeInstance.current.stop().then(() => {
          qrCodeInstance.current?.clear();
        }).catch(err => console.warn("Cleanup error during unmount:", err));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden relative shadow-2xl border border-white/10">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-gray-800 dark:text-white">ماسح الباركود الذكي</h3>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-500" />
           </button>
        </div>

        <div className="p-6">
           {error ? (
             <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-center text-sm font-medium">
                {error}
                <button 
                  onClick={() => window.location.reload()}
                  className="block mx-auto mt-2 text-xs underline flex items-center gap-1 justify-center animate-bounce"
                >
                  <RotateCcw className="w-3 h-3 animate-spin [animation-duration:4s]" /> إعادة المحاولة
                </button>
             </div>
           ) : (
             <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                <div id="reader" className="w-full h-full"></div>
                {!isReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                     جاري تهيئة الكاميرا...
                  </div>
                )}
                {/* Decorative scanning line */}
                {isReady && (
                   <div className="absolute inset-0 pointer-events-none border-2 border-primary/30 rounded-2xl">
                      <div className="w-full h-0.5 bg-primary absolute top-1/2 left-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                   </div>
                )}
             </div>
           )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 text-center">
           <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
             وجه كاميرا الهاتف الخلفية نحو باركود المنتج
           </p>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        #reader {
          border: none !important;
        }
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 1rem;
        }
      `}</style>
    </div>
  );
}
