import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bluetooth, BluetoothConnected, BluetoothSearching, RefreshCw, X, FileText, Printer, Wifi } from 'lucide-react';
import { BluetoothPrinterService, BleDevice } from '../../lib/bluetoothPrinter';
import { notify } from '../../lib/notifications';
import { Capacitor } from '@capacitor/core';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinterConnected?: (deviceId: string) => void;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({
  isOpen,
  onClose,
  onPrinterConnected
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [connType, setConnType] = useState<'bluetooth' | 'network'>(() => {
    try {
      return (localStorage.getItem('printer_connection_type') as 'bluetooth' | 'network') || 'bluetooth';
    } catch {
      return 'bluetooth';
    }
  });
  const [networkPrinterIp, setNetworkPrinterIp] = useState(() => {
    try {
      return localStorage.getItem('network_printer_ip') || '192.168.1.100';
    } catch {
      return '192.168.1.100';
    }
  });
  const [networkPrinterPort, setNetworkPrinterPort] = useState(() => {
    try {
      return localStorage.getItem('network_printer_port') || '9100';
    } catch {
      return '9100';
    }
  });

  useEffect(() => {
    // Check if printer is already connected on mount
    const checkConnection = () => {
      let type: 'bluetooth' | 'network' = 'bluetooth';
      try {
        type = (localStorage.getItem('printer_connection_type') as 'bluetooth' | 'network') || 'bluetooth';
        setConnType(type);
        setNetworkPrinterIp(localStorage.getItem('network_printer_ip') || '192.168.1.100');
        setNetworkPrinterPort(localStorage.getItem('network_printer_port') || '9100');
      } catch {}

      const connected = BluetoothPrinterService.isConnected();
      setIsConnected(connected);
      setConnectedId(BluetoothPrinterService.getConnectedDeviceId());
    };
    if (isOpen) {
      checkConnection();
    }
    // Poll connection status while modal is open
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const saveNetworkSettings = () => {
    try {
      localStorage.setItem('printer_connection_type', 'network');
      localStorage.setItem('network_printer_ip', networkPrinterIp);
      localStorage.setItem('network_printer_port', networkPrinterPort);
    } catch {}
    setConnType('network');
    setIsConnected(true);
    setConnectedId(`طابعة شبكة (${networkPrinterIp}:${networkPrinterPort})`);
    
    if (onPrinterConnected) {
      onPrinterConnected(`طابعة شبكة (${networkPrinterIp}:${networkPrinterPort})`);
    }
    notify.success('💾 تم حفظ اتصال طابعة الشبكة وتنشيطه بنجاح!');
  };

  const startScanning = async () => {
    setIsScanning(true);
    setDevices([]);
    try {
      if (!Capacitor.isNativePlatform()) {
        const success = await BluetoothPrinterService.connectWebBluetooth();
        if (success) {
          setIsConnected(true);
          const devId = BluetoothPrinterService.getConnectedDeviceId() || '';
          setConnectedId(devId);
          if (onPrinterConnected) {
            onPrinterConnected(devId);
          }
          onClose();
        }
        return;
      }
      await BluetoothPrinterService.scanPrinters((device) => {
        setDevices((prev) => {
          if (prev.some(d => d.deviceId === device.deviceId)) return prev;
          return [...prev, device];
        });
      }, 7000);
    } catch (error: any) {
      console.error(error);
      notify.error(error.message || 'فشل الاتصال أو المسح لأجهزة البلوتوث.');
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BleDevice) => {
    setConnectingId(device.deviceId);
    try {
      const success = await BluetoothPrinterService.connect(device.deviceId);
      if (success) {
        setIsConnected(true);
        setConnectedId(device.deviceId);
        notify.success(`تم الاتصال بالطابعة "${device.name}" بنجاح! 🖨️`);
        if (onPrinterConnected) {
          onPrinterConnected(device.deviceId);
        }
      }
    } catch (error: any) {
      console.error(error);
      notify.error(error.message || 'تعذر الاتصال بالطابعة المختارة.');
    } finally {
      setConnectingId(null);
    }
  };

  const disconnectDevice = async () => {
    try {
      await BluetoothPrinterService.disconnect();
      setIsConnected(false);
      setConnectedId(null);
      notify.success('تم قطع الاتصال بالطابعة بنجاح.');
    } catch (error: any) {
      console.error(error);
      notify.error('فشل قطع الاتصال بالطابعة.');
    }
  };

  const handleTestPrint = async () => {
    try {
      const dummyInvoice = {
        number: 'TEST-0001',
        createdAt: new Date().toISOString(),
        customerName: 'تجربة اتصال الطابعة',
        items: [
          { name: 'جوال سامسونج الترا 24', qty: 1, price: 95000 },
          { name: 'شاحن سريع أصلي 45W', qty: 2, price: 5000 }
        ],
        total: 105000,
        discount: 5000,
        tax: 0,
        paymentMethod: 'نقدًا'
      };
      notify.info('جاري إرسال تذكرة الفاتورة التجريبية للطابعة...');
      await BluetoothPrinterService.printInvoice(dummyInvoice, 'الحسام فون - تجربة');
      notify.success('تمت تجربة الطباعة بنجاح تام! 🎉');
    } catch (error: any) {
      console.error(error);
      notify.error(`فشلت تجربة الطباعة: ${error.message || error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          id="bluetooth-printer-modal-container"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-primary to-sky-600 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/15 rounded-xl">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">الاتصال بطابعة الكاشير المحمولة</h3>
                <p className="text-[10px] text-sky-100 font-medium">طباعة فواتير حرارية مباشرة عبر البلوتوث</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              id="close-bluetooth-printer-btn"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Connection Type Switcher Tab */}
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setConnType('bluetooth');
                  try {
                    localStorage.setItem('printer_connection_type', 'bluetooth');
                  } catch {}
                  const connected = BluetoothPrinterService.isConnected();
                  setIsConnected(connected);
                  setConnectedId(BluetoothPrinterService.getConnectedDeviceId());
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  connType === 'bluetooth'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white'
                    : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5" />
                بلوتوث (Bluetooth)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnType('network');
                  try {
                    localStorage.setItem('printer_connection_type', 'network');
                  } catch {}
                  const connected = BluetoothPrinterService.isConnected();
                  setIsConnected(connected);
                  setConnectedId(BluetoothPrinterService.getConnectedDeviceId());
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  connType === 'network'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                شبكة (Wi-Fi / IP)
              </button>
            </div>

            {/* Status Information Panel */}
            <div className={`p-4 rounded-2xl flex items-center justify-between transition-all ${
              isConnected 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-300'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                  {connType === 'network' ? (
                    <Wifi className={`w-5 h-5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                  ) : isConnected ? (
                    <BluetoothConnected className="w-5 h-5 text-emerald-500 animate-pulse" />
                  ) : (
                    <Bluetooth className="w-5 h-5 text-amber-500" />
                  )}
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs">الحالة الحالية للطابعة</h4>
                  <p className="text-[10px] opacity-80 mt-0.5">
                    {connType === 'network' 
                      ? (isConnected ? `طابعة الشبكة نشطة: ${connectedId}` : 'يرجى تهيئة عنوان الـ IP لحفظ الاتصال بالشبكة')
                      : (isConnected ? `متصل بـ: ${connectedId || 'طابعة البلوتوث'}` : 'غير متصل بأي طابعة بلوتوث حاليًا')
                    }
                  </p>
                </div>
              </div>
              
              {isConnected && connType === 'bluetooth' && (
                <button
                  onClick={disconnectDevice}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                  id="disconnect-printer-btn"
                >
                  فصل الاتصال
                </button>
              )}
            </div>

            {/* Test Actions */}
            {isConnected && (
              <div className="p-4 bg-sky-50/50 dark:bg-sky-950/10 border border-sky-100/50 dark:border-sky-900/10 rounded-2xl space-y-3">
                <h5 className="font-bold text-xs text-sky-950 dark:text-sky-300 text-right">أدوات الفحص والتشغيل</h5>
                <button
                  onClick={handleTestPrint}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="test-print-slip-btn"
                >
                  <FileText className="w-4 h-4" />
                  طباعة فاتورة تجريبية (إيصال اختبار)
                </button>
              </div>
            )}

            {/* Config Area depends on selection */}
            {connType === 'bluetooth' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">طابعات البلوتوث المتاحة بالقرب منك</span>
                  <button
                    disabled={isScanning}
                    onClick={startScanning}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-sky-600 transition-colors disabled:opacity-50 cursor-pointer bg-none border-none p-0"
                    id="scan-printers-btn"
                  >
                    {isScanning ? (
                      <>
                        <BluetoothSearching className="w-3.5 h-3.5 animate-spin" />
                        جاري المسح...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        {!Capacitor.isNativePlatform() ? 'اقتران واتصال بالطابعة' : 'إعادة البحث'}
                      </>
                    )}
                  </button>
                </div>

                {/* Discovered Printer List */}
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {devices.length === 0 ? (
                    <div className="text-center py-6 p-4 bg-amber-50/20 dark:bg-amber-950/5 border border-amber-100/50 dark:border-amber-900/10 rounded-2xl">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                        {!Capacitor.isNativePlatform() 
                          ? 'أنت تستخدم النظام عبر المتصفح. انقر فوق زر "اقتران واتصال بالطابعة" بالأعلى لفتح نافذة اقتران البلوتوث المباشرة بالمتصفح واختيار طابعتك الحرارية.'
                          : (isScanning 
                            ? 'يرجى الانتظار، جاري البحث عن طابعات الفواتير المحمولة...' 
                            : 'انقر فوق "إعادة البحث" للبحث عن الطابعات الحرارية النشطة بالقرب منك.')}
                      </p>
                    </div>
                  ) : (
                    devices.map((device, index) => {
                      const isConnecting = connectingId === device.deviceId;
                      const isCurrent = connectedId === device.deviceId;

                      return (
                        <motion.div
                          key={device.deviceId}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01 }}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                            isCurrent
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                              : 'bg-white dark:bg-slate-800/10 hover:bg-gray-50 dark:hover:bg-slate-800/30 border-gray-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isCurrent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                              <Printer className="w-4 h-4" />
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-xs text-gray-800 dark:text-gray-200 block">{device.name}</span>
                              <span className="font-mono text-[9px] text-gray-400 mt-0.5 block">{device.deviceId}</span>
                            </div>
                          </div>

                          <button
                            disabled={isConnecting || isCurrent}
                            onClick={() => connectToDevice(device)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center min-w-[75px] cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-100 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400'
                                : 'bg-primary hover:bg-opacity-90 active:scale-97 text-white shadow-xs border-none'
                            }`}
                            id={`connect-btn-${device.deviceId}`}
                          >
                            {isConnecting ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isCurrent ? (
                              'متصل حالياً'
                            ) : (
                              'توصيل'
                            )}
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Network Wi-Fi Panel */
              <div className="p-4 bg-gray-50 dark:bg-slate-800/20 border border-gray-150/40 dark:border-slate-800 rounded-2xl space-y-4 text-right">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <Wifi className="w-4.5 h-4.5" />
                  <span>تهيئة عنوان IP لطابعة الشبكة الحرارية</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block">عنوان IP الخاص بالطابعة</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={networkPrinterIp}
                      onChange={(e) => setNetworkPrinterIp(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold border border-gray-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 text-left"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block">منفذ الاتصال (Port)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={networkPrinterPort}
                      onChange={(e) => setNetworkPrinterPort(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold border border-gray-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 text-left"
                      placeholder="9100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={saveNetworkSettings}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-xl text-xs transition-all cursor-pointer active:scale-97 flex items-center justify-center gap-1.5 border-none"
                  >
                    حفظ وتنشيط اتصال طابعة الشبكة 💾
                  </button>
                </div>
              </div>
            )}

            {/* Note */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/30 rounded-2xl flex items-start gap-2.5">
              <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-normal text-right">
                {connType === 'network'
                  ? 'طابعات الشبكة (Wi-Fi / Ethernet) تتطلب أن يكون هاتفك أو جهازك متصلاً بنفس شبكة الـ Wi-Fi المحلية المتصلة بها الطابعة الحرارية وتعمل بتوافق تام.'
                  : 'تأكد من تشغيل طابعة البلوتوث وتفعيل البلوتوث في هاتفك الذكي. تقنية BLE تدعم طباعة نصوص الفواتير بتنسيق ESC/POS القياسي.'
                }
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
