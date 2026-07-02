import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  const confirm = (options: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const parsedOptions: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setConfig({
        ...parsedOptions,
        resolve
      });
      setIsOpen(true);
    });
  };

  const handleCancel = () => {
    setIsOpen(false);
    config?.resolve(false);
  };

  const handleConfirm = () => {
    setIsOpen(false);
    config?.resolve(true);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {isOpen && config && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop with elegat blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden z-20 p-5 text-right font-sans"
              dir="rtl"
            >
              <div className="flex flex-col items-center text-center space-y-3.5">
                {/* Visual Icon */}
                <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  config.isDanger 
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-500' 
                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-500'
                }`}>
                  {config.isDanger ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
                </span>

                <div className="space-y-1.5 w-full">
                  <h3 className="font-extrabold text-sm text-gray-950 dark:text-gray-100">
                    {config.title || 'تأكيد الإجراء الكاشير'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-bold font-sans">
                    {config.message}
                  </p>
                </div>

                <div className="flex gap-2 w-full pt-1">
                  <button
                    onClick={handleConfirm}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black border-none cursor-pointer transition-all active:scale-98 text-white ${
                      config.isDanger 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-primary hover:bg-opacity-95'
                    }`}
                  >
                    {config.confirmText || 'تأكيد ومتابعة'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-2.5 px-4 bg-gray-150 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold border-none cursor-pointer transition-all active:scale-98"
                  >
                    {config.cancelText || 'إلغاء تراجع'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used inside ConfirmProvider');
  }
  return context;
}
