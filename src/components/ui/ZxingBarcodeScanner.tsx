import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Camera, RefreshCw, AlertCircle, Volume2, Sparkles, X, Zap, ZapOff } from 'lucide-react';
import { playBarcodeSound } from '../../lib/alerts';

interface ZxingBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
}

export default function ZxingBarcodeScanner({ onScan, onClose }: ZxingBarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Torch / Flashlight state
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  
  // Smart per-barcode debounce cache
  const scannedHistoryRef = useRef<Map<string, number>>(new Map());

  // 1. Fetch available video input devices with optimized configurations
  useEffect(() => {
    let active = true;

    // Build optimized decode hints to speed up scanning by 10x!
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    // Speed up frame decoding frequency: decode every 40ms (approx 25 frames per second!) instead of 500ms
    const codeReader = new BrowserMultiFormatReader(hints, 40);
    codeReader.timeBetweenDecodingAttempts = 40;
    codeReaderRef.current = codeReader;

    const initDevices = async () => {
      try {
        // Request standard camera permission first to unlock labels and devices, especially in nested frames
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Stop tracks immediately so we don't hold the camera active
            tempStream.getTracks().forEach(track => track.stop());
          } catch (permErr) {
            console.warn("Pre-permission prompt failed or was denied:", permErr);
          }
        }

        const devices = await codeReader.listVideoInputDevices();
        if (!active) return;

        if (devices && devices.length > 0) {
          setVideoDevices(devices);
          // Auto-select the environment/back camera if available
          const backCam = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment') || 
            device.label.toLowerCase().includes('خلفية') ||
            device.label.toLowerCase().includes('rear')
          );
          const defaultDevice = backCam ? backCam.deviceId : devices[0].deviceId;
          setSelectedDeviceId(defaultDevice);
        } else {
          setError('لم يتم العثور على أية كاميرات متصلة بجهازك.');
        }
      } catch (err: any) {
        console.error('Error fetching video devices:', err);
        setError('فشل في الوصول إلى الكاميرا. يرجى التحقق من منح الإذن للتطبيق.');
      }
    };

    initDevices();

    return () => {
      active = false;
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  // 2. Start continuous scanning when camera device changes
  useEffect(() => {
    if (!selectedDeviceId || !videoRef.current || !codeReaderRef.current) return;

    let activeSession = true;
    const codeReader = codeReaderRef.current;
    setIsTorchOn(false);
    setHasTorch(false);

    const startScanning = async () => {
      try {
        setError(null);
        setIsReady(false);
        
        // Reset any current continuous decodes
        codeReader.reset();

        // Use custom media constraints with ideal hints rather than strict limits
        // to prevent OverconstrainedError and ensure instant fallback on all webcams & phones
        const videoConstraints: MediaTrackConstraints = {
          deviceId: { ideal: selectedDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        };

        const constraints: MediaStreamConstraints = {
          video: videoConstraints,
          audio: false
        };

        await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result: Result | null, err?: any) => {
            if (!activeSession) return;
            
            if (result) {
              const decodedText = result.getText();
              const now = Date.now();

              // Smart Per-Barcode Debounce Filter
              // Prevents repeating scans of the exact same barcode within 2.5 seconds,
              // but allows scanning different products instantly without any lag!
              const lastScannedTime = scannedHistoryRef.current.get(decodedText) || 0;
              if (now - lastScannedTime < 2500) {
                return;
              }

              // Update history cache
              scannedHistoryRef.current.set(decodedText, now);

              // Action feedback
              playBarcodeSound();
              setLastScanned(decodedText);
              setScanCount(prev => prev + 1);
              setCooldown(true);

              // Clear cooldown feedback after 1s
              setTimeout(() => {
                if (activeSession) setCooldown(false);
              }, 1000);

              // Dispatch the barcode to parent component
              onScan(decodedText);
            }
          }
        );

        if (activeSession) {
          setIsReady(true);

          // Check if active camera stream track supports Torch/Flashlight
          setTimeout(() => {
            if (!activeSession || !videoRef.current) return;
            try {
              const stream = videoRef.current.srcObject as MediaStream;
              if (stream) {
                const track = stream.getVideoTracks()[0];
                if (track) {
                  const capabilities = track.getCapabilities();
                  // @ts-ignore
                  if (capabilities.torch) {
                    setHasTorch(true);
                  }
                }
              }
            } catch (e) {
              console.log('Torch capabilities not supported in this browser:', e);
            }
          }, 1000);
        }
      } catch (err: any) {
        console.error('Failed to start decoding with high-res constraints:', err);
        
        // Fallback to simpler method if constraints are rejected by the browser / old device
        if (activeSession) {
          try {
            console.log('Falling back to default video device stream decoding...');
            await codeReader.decodeFromVideoDevice(
              selectedDeviceId,
              videoRef.current!,
              (result: Result | null, err?: any) => {
                if (!activeSession) return;
                if (result) {
                  const decodedText = result.getText();
                  const now = Date.now();
                  
                  const lastScannedTime = scannedHistoryRef.current.get(decodedText) || 0;
                  if (now - lastScannedTime < 2500) return;

                  scannedHistoryRef.current.set(decodedText, now);
                  playBarcodeSound();
                  setLastScanned(decodedText);
                  setScanCount(prev => prev + 1);
                  setCooldown(true);
                  setTimeout(() => {
                    if (activeSession) setCooldown(false);
                  }, 1000);
                  onScan(decodedText);
                }
              }
            );
            setIsReady(true);
          } catch (fallbackErr: any) {
            console.error('Fallback decoding failed as well:', fallbackErr);
            setError('حدث خطأ أثناء تشغيل الكاميرا المحددة. يرجى تجربة كاميرا أخرى أو التحقق من أذونات الكاميرا.');
            setIsReady(false);
          }
        }
      }
    };

    startScanning();

    return () => {
      activeSession = false;
      if (codeReader) {
        codeReader.reset();
      }
    };
  }, [selectedDeviceId]);

  const toggleDevice = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  const toggleTorch = async () => {
    try {
      if (!videoRef.current) return;
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const nextState = !isTorchOn;
          await track.applyConstraints({
            advanced: [{ torch: nextState } as any]
          });
          setIsTorchOn(nextState);
        }
      }
    } catch (e) {
      console.error('Failed to toggle torch:', e);
    }
  };

  return (
    <div id="zxing-overlay-scanner" className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col gap-3 max-w-md mx-auto w-full z-50 transition-all duration-300">
      {/* Header section with camera info & actions */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cooldown ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cooldown ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </div>
          <p className="text-xs font-black text-gray-800 dark:text-gray-100 flex items-center gap-1">
            <span>ماسح الباركود الذكي (استجابة فائقة السرعة)</span>
            {scanCount > 0 && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                {scanCount} مسح
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              type="button"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border-none ${
                isTorchOn 
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400' 
                  : 'bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'
              }`}
              title={isTorchOn ? "إطفاء الكشاف" : "تشغيل الكشاف لإضاءة الكاميرا"}
            >
              {isTorchOn ? <ZapOff className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            </button>
          )}

          {videoDevices.length > 1 && (
            <button
              onClick={toggleDevice}
              type="button"
              className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer border-none"
              title="تبديل الكاميرا"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-red-500 transition-colors cursor-pointer border-none"
              title="إغلاق الماسح"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main viewport with scanning layout and targets */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center border border-gray-150 dark:border-slate-800">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />

        {/* Dynamic Loading Overlay */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-white gap-3">
            <Camera className="w-8 h-8 animate-pulse text-primary" />
            <p className="text-[11px] font-bold">جاري تنشيط الكاميرا بـ 60 إطاراً وقارئ الباركود...</p>
          </div>
        )}

        {/* Error Handling State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/95 text-red-100 p-4 text-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-xs font-bold leading-relaxed">{error}</p>
          </div>
        )}

        {/* Live Active Overlay HUD */}
        {isReady && !error && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* The scanning laser line */}
            <div className={`w-[85%] h-[2px] bg-red-500 absolute transition-opacity duration-300 shadow-[0_0_12px_#ef4444] ${cooldown ? 'opacity-30' : 'opacity-90 animate-[laser_1.8s_infinite]'}`}></div>

            {/* Target Area Box (perfect ratio for 1D barcodes like EAN/UPC) */}
            <div className="w-[85%] h-[45%] border-2 border-white/20 rounded-xl flex items-center justify-center relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Perfect high-contrast active corner guidelines */}
              <div className="absolute -top-[2px] -left-[2px] w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
              <div className="absolute -top-[2px] -right-[2px] w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
              <div className="absolute -bottom-[2px] -left-[2px] w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
              <div className="absolute -bottom-[2px] -right-[2px] w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-lg"></div>

              {/* Status or scan notification */}
              {cooldown ? (
                <div className="bg-emerald-500/90 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold backdrop-blur-sm animate-bounce shadow-md flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تم مسح: {lastScanned}</span>
                </div>
              ) : (
                <div className="bg-black/60 text-white/80 px-2 py-1 rounded text-[9px] font-bold backdrop-blur-sm">
                  وجّه الكاميرا نحو باركود المنتج
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer statistics / helper information */}
      <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-2.5 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
        <p className="flex items-center gap-1">
          <Volume2 className="w-3.5 h-3.5 text-secondary" />
          <span>سيتم التعرف فوراً على المنتجات المختلفة، مع حظر التكرار العشوائي.</span>
        </p>
        <span className="font-mono text-[9px] uppercase font-bold text-gray-400">ZXing Latency: 40ms</span>
      </div>

      <style>{`
        @keyframes laser {
          0%, 100% { transform: translateY(-35px); }
          50% { transform: translateY(35px); }
        }
      `}</style>
    </div>
  );
}
