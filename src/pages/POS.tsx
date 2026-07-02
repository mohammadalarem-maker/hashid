import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  User,
  X,
  CreditCard,
  Banknote,
  ScanLine,
  Camera,
  CheckCircle,
  AlertCircle,
  Printer,
  Wallet,
  Star,
  RefreshCw,
  Bluetooth,
  Coins,
  Mic
} from 'lucide-react';
import BarcodeScanner from '../components/ui/BarcodeScanner';
import ZxingBarcodeScanner from '../components/ui/ZxingBarcodeScanner';
import { BluetoothPrinterModal } from '../components/ui/BluetoothPrinterModal';
import { BluetoothPrinterService } from '../lib/bluetoothPrinter';
import { playBarcodeSound, playSuccessSound, playWarningSound } from '../lib/alerts';
import { exportToPDF } from '../lib/pdfExport';
import { ProductImage } from '../components/ProductImage';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  increment,
  runTransaction
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { notify, sendSaleNotificationToAdmins, sendLowStockNotificationToAdmins } from '../lib/notifications';
import { logActivity } from '../lib/activity';
import { useData, POSItem, Customer } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';

const getCurrencySymbol = (currencyCode: string | undefined): string => {
  return 'ر.ي';
};

const ProductCard = React.memo(function ProductCard({
  p,
  onAdd
}: {
  p: POSItem;
  onAdd: (item: POSItem) => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onAdd(p)}
      className="bg-surface p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/10 transition-all text-right flex flex-col min-h-[120px] md:min-h-[140px] h-full relative overflow-hidden group cursor-pointer"
    >
      <div className="flex-1 w-full flex gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-[9px] text-secondary font-bold bg-secondary/10 px-1.5 py-0.5 rounded-full uppercase">{p.category}</span>
          <h4 className="font-bold text-primary mt-2 text-xs md:text-sm line-clamp-2 dark:text-foreground leading-snug">{p.name}</h4>
          <p className="text-[9px] text-gray-400 mt-1">المخزون: {p.stock} {p.unit}</p>
        </div>
        <div className="w-11 h-11 md:w-12 md:h-12 bg-gray-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700 shrink-0 self-start mt-1">
          <ProductImage src={p.imageUrl} alt={p.name} category={p.category} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-2 w-full">
        <p className="text-secondary font-black text-xs md:text-sm">{(p.price || 0).toLocaleString()} <span className="text-[9px] opacity-70">{getCurrencySymbol(p.currency)}</span></p>
        <div className="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
          <Plus className="w-3 h-3" />
        </div>
      </div>
      {p.stock <= (p.minStock || 5) && p.stock > 0 && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 text-amber-500">
          <AlertCircle className="w-3 h-3" />
        </div>
      )}
      {p.stock <= 0 && <div className="absolute inset-0 bg-surface/80 flex items-center justify-center font-bold text-red-600 text-[10px] backdrop-blur-[1px]">نفذت الكمية</div>}
    </motion.button>
  );
});

export default function POS() {
  const { role: userRole } = useAuth();
  const { 
    items, 
    customers, 
    categories: categoriesData, 
    shopSettings, 
    loading, 
    cart, 
    addToCart: centralAddToCart, 
    updateQty: centralUpdateQty, 
    updatePrice, 
    removeFromCart, 
    clearCart,
    invoices
  } = useData();

  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [showScanner, setShowScanner] = useState(false);
  const [showInlineScanner, setShowInlineScanner] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'wallet' | 'debt'>('cash');
  const [selectedWallet, setSelectedWallet] = useState('الكريمي (M-Floos)');
  const [allowOverSell, setAllowOverSell] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(36);
  
  useEffect(() => {
    setVisibleLimit(36);
  }, [searchTerm, selectedCategory]);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerType, setCustomerType] = useState<'guest' | 'registered'>('guest');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('الدفع عند الاستلام (Due on Receipt)');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [isListening, setIsListening] = useState(false);

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      notify.error('عذراً، ميزة التعرف على الصوت غير مدعومة في هذا المتصفح. يرجى استخدام متصفح يدعم هذه الميزة مثل Google Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ar-YE';

    recognition.onstart = () => {
      setIsListening(true);
      notify.success('🎤 جاري الاستماع للأوامر الصوتية باللغة العربية...');
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        notify.info('لم يتم اكتشاف صوت. يرجى التحدث بوضوح.');
      } else if (event.error === 'not-allowed') {
        notify.error('يرجى السماح بصلاحية الميكروفون لاستخدام ميزة البحث الصوتي.');
      } else {
        notify.error(`فشل التعرف على الصوت: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setSearchTerm(transcript);
        notify.success(`🔎 تم البحث عن: "${transcript}"`);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadLogoAsBase64 = async () => {
      const src = shopSettings?.logoUrl || defaultAppIcon;
      if (!src) return;
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (active && reader.result) {
            setLogoBase64(reader.result as string);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('Failed to pre-load / convert logo to base64:', err);
        if (active) {
          setLogoBase64(src);
        }
      }
    };
    loadLogoAsBase64();
    return () => {
      active = false;
    };
  }, [shopSettings?.logoUrl]);

  const yemeniWallets = [
    'الكريمي (M-Floos)',
    'بيس (Pyes)',
    'ون كاش (One Cash)',
    'يسر (Yousur)',
    'شامل موني (Shamil Money)',
    'تضامن باي (Tadhamon Pay)',
    'موبايلي موني (Mobily Money)',
    'جيب (Jeeb)',
    'جوالي (Jawali)',
  ];

  const paymentTermsOptions = [
    'الدفع عند الاستلام (Due on Receipt)',
    'صافي 15 يوم (Net 15)',
    'صافي 30 يوم (Net 30)',
    'صافي 60 يوم (Net 60)',
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length > 3) {
      const exactMatch = items.find(i => i.code === searchTerm.trim());
      if (exactMatch) {
         addToCart(exactMatch);
         setSearchTerm('');
      }
    }
  }, [searchTerm, items]);

  const addToCart = (item: POSItem) => {
    centralAddToCart(
      item,
      (msg) => notify.error(msg),
      (msg) => notify.success(msg)
    );
  };

  const handleBarcodeScan = (barcode: string) => {
    if (!barcode) return;
    const cleanBarcode = barcode.trim().toLowerCase();
    
    // Find item with exact match or case-insensitive trimmed match
    let item = items.find(p => {
      const pCode = (p.code || '').trim().toLowerCase();
      if (!pCode) return false;
      return pCode === cleanBarcode;
    });

    // Fallback: match without leading zeros if one has them and the other doesn't
    if (!item) {
      const barcodeNoZeros = cleanBarcode.replace(/^0+/, '');
      item = items.find(p => {
        const pCodeNoZeros = (p.code || '').trim().toLowerCase().replace(/^0+/, '');
        if (!pCodeNoZeros) return false;
        return pCodeNoZeros === barcodeNoZeros;
      });
    }

    if (item) {
      playBarcodeSound();
      addToCart(item);
      notify.success(`تم العثور على المنتج وإضافته: ${item.name} ✅`);
    } else {
      playWarningSound();
      notify.error(`عذراً، الباركود (${barcode.trim()}) غير مسجل لأي منتج في المخازن!`);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!lastInvoice) {
      notify.error('حدث خطأ: لا توجد فاتورة نشطة لطباعتها.');
      return;
    }
    
    if (!BluetoothPrinterService.isConnected()) {
      notify.info('يرجى أولاً اختيار وتوصيل طابعة البلوتوث الكاشير.');
      setShowBluetoothModal(true);
      return;
    }

    notify.info('جاري إرسال الفاتورة للطابعة الحرارية...');
    try {
      await BluetoothPrinterService.printInvoice(lastInvoice, shopSettings?.shopName || 'الحسام فون', shopSettings);
      notify.success('تمت طباعة إيصال البلوتوث بنجاح! 🖨️');
    } catch (error: any) {
      console.error(error);
      notify.error(`فشلت الطباعة: ${error.message || error}`);
    }
  };

  const updateQty = (id: string, value: number | string) => {
    centralUpdateQty(
      id,
      value,
      allowOverSell,
      (msg) => notify.error(msg)
    );
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    
    let invoiceId = `INV-${Date.now()}`;
    if (shopSettings?.autoIncrementInvoice) {
      const prefix = shopSettings?.invoicePrefix ?? 'INV-';
      const startNum = Number(shopSettings?.invoiceStartNumber ?? 1001);
      
      let maxNum = startNum - 1;
      if (Array.isArray(invoices)) {
        invoices.forEach((inv: any) => {
          const numStr = inv.number || '';
          if (prefix && numStr.startsWith(prefix)) {
            const numericPart = numStr.substring(prefix.length);
            const parsed = parseInt(numericPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          } else {
            const parsed = parseInt(numStr, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        });
      }
      const nextNum = maxNum + 1;
      invoiceId = `${prefix}${String(nextNum).padStart(5, '0')}`;
    }

    try {
      const invoiceResult = await runTransaction(db, async (transaction) => {
        // 0. Verify and fetch both User and Items in Parallel for extreme speed!
        const userDocRef = auth.currentUser ? doc(db, 'users', auth.currentUser.uid) : null;
        
        const [userSnap, ...itemSnaps] = await Promise.all([
          userDocRef ? transaction.get(userDocRef) : Promise.resolve(null),
          ...cart.map(cartItem => transaction.get(doc(db, 'items', cartItem.item.id)))
        ]);

        if (userSnap && userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.status === 'suspended' || userData.status === 'disabled' || userData.status === 'inactive') {
            throw new Error('DISABLED_USER');
          }
        }

        // 1. Check stock for all items using already fetched snapshots
        for (let idx = 0; idx < cart.length; idx++) {
          const cartItem = cart[idx];
          const itemSnap = itemSnaps[idx];
          if (!itemSnap || !itemSnap.exists()) {
            throw new Error(`Item ${cartItem.item.name} not found`);
          }
          const currentStock = itemSnap.data().stock || 0;
          if (!allowOverSell && currentStock < cartItem.qty) {
            throw new Error(`كمية غير كافية من ${cartItem.item.name} (المتوفر: ${currentStock})`);
          }
        }

        // 2. Update stock and create invoice
        const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const grandTotal = total;
        const saleCurrency = 'YER';

        const isDebt = paymentType === 'debt' || paymentTerms !== 'الدفع عند الاستلام (Due on Receipt)';
        const earnedPoints = Math.floor(grandTotal / 1000); // 1 point for each 1000 YER

        const currencies = [
          { code: 'YER', symbol: 'ر.ي', rate: 1, isBase: true }
        ];

        const currencyEquivalents: { [code: string]: number } = { YER: grandTotal };

        const invoiceRef = doc(collection(db, 'invoices'));
        
        const invoiceData = {
          number: invoiceId,
          date: new Date().toISOString(),
          total: grandTotal,
          subtotal: total,
          tax: 0,
          status: isDebt ? 'unpaid' : 'paid',
          paymentType: paymentType === 'wallet' ? `Wallet: ${selectedWallet}` : paymentType,
          customer: customerName,
          customerId: selectedCustomerId,
          paymentTerms: paymentType === 'debt' ? 'دين (On Credit)' : paymentTerms,
          earnedPoints: selectedCustomerId ? earnedPoints : 0,
          createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
          userId: auth.currentUser?.uid || null,
          multiCurrencyActive: shopSettings?.multiCurrencyActive || false,
          currency: saleCurrency,
          currencyEquivalents,
          currencyRatesAtSale: currencies,
          items: cart.map(i => ({
            id: i.item.id,
            name: i.item.name,
            qty: i.qty,
            price: i.price,
            purchasePrice: (i.item as any).purchasePrice || 0
          }))
        };
        transaction.set(invoiceRef, invoiceData);

        // 2.5 Create Debt if applicable
        if (isDebt) {
          const debtRef = doc(collection(db, 'debts'));
          const customer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;
          transaction.set(debtRef, {
            contactName: customerName,
            amount: grandTotal,
            remainingAmount: grandTotal,
            type: 'receivable',
            date: invoiceData.date,
            status: 'pending',
            description: `فاتورة رقم ${invoiceId}${paymentType === 'debt' ? ' (دين مباشر)' : ''}`,
            phoneNumber: customer?.phone || '',
            createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
            userId: auth.currentUser?.uid || null
          });
        }

        // 3. Update customer stats if selected
        if (selectedCustomerId) {
          const customerRef = doc(db, 'customers', selectedCustomerId);
          transaction.update(customerRef, {
            totalPurchases: increment(grandTotal),
            lastPurchaseDate: invoiceData.date,
            points: increment(earnedPoints)
          });
        }

        for (const cartItem of cart) {
          const itemRef = doc(db, 'items', cartItem.item.id);
          transaction.update(itemRef, {
            stock: increment(-cartItem.qty)
          });
        }

        return invoiceData;
      });

      setLastInvoice(invoiceResult);
      setSuccess(true);
      playSuccessSound();
      
      const finalSaleCurrency = 'YER';

      // إرسال إشعار فوري وتنبيه للمدراء خارج التطبيق
      if (invoiceResult) {
        const cashierName = auth.currentUser?.displayName || auth.currentUser?.email || 'كاشير مبيعات';
        sendSaleNotificationToAdmins(
          invoiceResult.total,
          invoiceResult.number,
          invoiceResult.paymentType || 'نقدي',
          cashierName,
          invoiceResult.currency,
          userRole
        ).catch((err) => console.warn("Failed to dispatch client-side admin sales push notification:", err));

        // إرسال كافه البيانات المبيعات إلى fcm و PHP backend
        fetch('/php-backend/sell.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            total_amount: invoiceResult.total,
            currency: finalSaleCurrency,
            invoice_id: invoiceResult.number
          })
        }).then(res => res.json())
          .then(data => {
            console.log('PHP FCM Notification outcome:', data);
            // تشغيل صوت رنين محلي فوري للكاشير عند نجاح العملية سحابياً ومحلياً
            try {
              const localReceiptBell = new Audio('/sounds/success.mp3');
              localReceiptBell.play().catch(() => {
                // حل برمجي احتياطي باستخدام Web Audio API لتجاوز قيود متصفحات الكروم والهواتف
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime); // نغمة رنين واضحة (A5)
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
              });
            } catch (soundErr) {
              console.warn('Local cashier audio chime block bypassed:', soundErr);
            }
          })
          .catch(err => console.warn('Failed to dispatch PHP FCM Notification:', err));

        // إرسال تنبيه دين جديد إذا كان نوع الدفع بالدين
        const transactionIsDebt = paymentType === 'debt' || paymentTerms !== 'الدفع عند الاستلام (Due on Receipt)';
        if (transactionIsDebt) {
          fetch('/php-backend/add_debt.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customer_name: customerName,
              amount: invoiceResult.total,
              currency: finalSaleCurrency
            })
          }).then(res => res.json())
            .then(data => console.log('PHP FCM Debt Notification outcome:', data))
            .catch(err => console.warn('Failed to dispatch PHP FCM Debt Notification:', err));
        }
      }
      
      // Check if any item in the completed transaction has dropped to or below its minimum stock
      cart.forEach(cartItem => {
        const remainingStock = (cartItem.item.stock || 0) - cartItem.qty;
        const minLimit = cartItem.item.minStock || 0;
        if (remainingStock <= minLimit) {
          sendLowStockNotificationToAdmins(
            cartItem.item.name,
            remainingStock,
            minLimit
          ).catch((e) => console.warn("Failed to dispatch low stock push alert:", e));

          // إرسال إشعار لـ المخزون المنخفض لـ PHP backend لربط فوري للتنبيهات السحابية
          fetch('/php-backend/check_low_stock.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              item_name: cartItem.item.name,
              current_stock: remainingStock,
              min_stock: minLimit,
              unit: cartItem.item.unit || 'قطعة'
            })
          }).then(res => res.json())
            .then(data => console.log('PHP Low Stock Notification outcome:', data))
            .catch(err => console.warn('Failed to dispatch PHP Low Stock Notification:', err));
          
          // Log low stock warning activity for admin audit logs interface
          logActivity(
            'تنبيه مخزن: كمية منخفضة', 
            cartItem.item.id, 
            'items', 
            { itemName: cartItem.item.name, remainingStock, minLimit }
          ).catch((e) => console.warn("Failed to log low stock tracking event:", e));
        }
      });

      // تسجيل نشاط العملية الخلفية دون حظر واجهة المستخدم لزيادة سرعة الكاشير لضعفين
      logActivity('إنشاء فاتورة مبيعات', invoiceId, 'invoices', {
        number: invoiceId,
        total: invoiceResult.total,
        paymentType: paymentType,
        itemsCount: cart.length,
        customer: customerName,
        tax: invoiceResult.tax || 0,
        items: cart.map(i => ({
          id: i.item.id,
          name: i.item.name,
          qty: i.qty,
          price: i.price
        }))
      }).catch((e) => console.warn("Failed to log checkout activity in background:", e));

      notify.success('تم إتمام العملية بنجاح');
      clearCart();
      // Show success for 3 seconds, then reset
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      if (error && (error.message === 'DISABLED_USER' || error.message?.includes('DISABLED_USER'))) {
        notify.error('عذراً، هذا الحساب معطل حالياً، يرجى مراجعة مدير النظام');
        setTimeout(() => {
          signOut(auth);
        }, 2200);
      } else {
        notify.error(error.message || "حدث خطأ أثناء إتمام العملية");
      }
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const total = useMemo(() => {
    return cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  }, [cart]);
  
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter(i => {
      const matchesSearch = !term || 
        (i.name && i.name.toLowerCase().includes(term)) || 
        (i.code && i.code.toLowerCase().includes(term));
      const matchesCategory = selectedCategory === 'الكل' || i.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  const itemsToShow = useMemo(() => {
    return filteredItems.slice(0, visibleLimit);
  }, [filteredItems, visibleLimit]);

  const [showMobileCart, setShowMobileCart] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-0 lg:gap-6 -m-4 text-foreground overflow-hidden relative" dir="rtl">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      <BluetoothPrinterModal isOpen={showBluetoothModal} onClose={() => setShowBluetoothModal(false)} />
      
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-primary/95 text-white p-6 print:bg-white print:p-0"
          >
             <motion.div 
               initial={{ scale: 0.5, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="text-center space-y-6 print:hidden w-full max-w-lg"
             >
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                   <CheckCircle className="w-10 h-10 md:w-16 md:h-16" />
                </div>
                
                 <h2 className="text-2xl md:text-4xl font-black text-white font-sans">تمت العملية بنجاح!</h2>

                 
                 {lastInvoice?.currencyEquivalents && Object.keys(lastInvoice.currencyEquivalents).length > 0 && shopSettings?.multiCurrencyActive && (
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 max-w-sm mx-auto space-y-2 mt-4 text-right">
                       <p className="text-xs font-black text-white/95 border-b border-white/10 pb-1.5 flex items-center gap-1.5 font-sans justify-end">
                          <span>مكافئ القيمة بالعملات الأجنبية:</span>
                          <Coins className="w-4 h-4 text-emerald-300" />
                       </p>
                       <div className="grid grid-cols-2 gap-3 text-xs-rtl">
                          {Object.entries(lastInvoice.currencyEquivalents).map(([code, val]: any) => {
                             if (code === (shopSettings?.currency || 'ر.ي')) return null;
                             const currSymbol = lastInvoice.currencyRatesAtSale?.find((c: any) => c.code === code)?.symbol || code;
                             return (
                                <div key={code} className="flex justify-between bg-black/15 py-1.5 px-3 rounded-lg border border-white/5 font-sans" dir="ltr">
                                   <span className="font-mono font-bold text-white">{(val || 0).toLocaleString()} {currSymbol}</span>
                                   <span className="text-white/70">{code}:</span>
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 )}

                <p className="text-lg md:text-xl opacity-80 text-white font-mono">رقم الفاتورة: {lastInvoice?.number}</p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center pt-8 px-4">
                  <button 
                    onClick={() => {
                      try {
                        window.print();
                        if (window.self !== window.top) {
                          notify.info('تلميح: إذا لم تظهر نافذة الطباعة لداعي الأمان، يرجى تشغيل التطبيق في نافذة مستقلة خارج نظام المعاينة.');
                        }
                      } catch (err) {
                        console.error('Print failed:', err);
                        notify.error('تنبيه: يمنع المتصفح الطباعة المباشرة من داخل إطار المعاينة. يرجى استخدام زر "تحميل PDF" لطباعتها.');
                      }
                    }}
                    className="bg-white text-primary px-6 py-3 rounded-2xl font-bold text-sm md:text-base hover:bg-gray-100 transition-colors shadow-2xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 md:w-5 h-5 text-primary" /> الطباعة العادية
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!lastInvoice) return;
                      notify.info('جاري إعداد وتحميل الفاتورة كـ PDF...');
                      try {
                        await exportToPDF('pos-receipt-print', `pos_receipt_${lastInvoice.number}`, false, lastInvoice, shopSettings);
                        notify.success('تم تحميل فاتورة الـ PDF بنجاح!');
                      } catch (err) {
                        console.error('PDF generation failed:', err);
                        notify.error('حدث خطأ أثناء تحميل الفاتورة، يرجى فتح التطبيق في تبويب جديد أو المحاولة مرة أخرى.');
                      }
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm md:text-base hover:bg-blue-700 transition-colors shadow-2xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    تحميل فاتورة PDF
                  </button>
                  <button 
                    onClick={handleBluetoothPrint}
                    className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold text-sm md:text-base hover:bg-emerald-600 transition-colors shadow-2xl flex items-center justify-center gap-1.5 active:scale-97 cursor-pointer"
                  >
                    <Bluetooth className="w-4 h-4 md:w-5 h-5 text-white" /> طباعة بلوتوث 🖨️
                  </button>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="bg-primary-dark/20 text-white border border-white/20 px-6 py-3 rounded-2xl font-bold text-sm md:text-base hover:bg-white/10 transition-colors cursor-pointer w-full sm:w-auto"
                  >
                    متابعة مبيعات جديدة
                  </button>
                </div>
             </motion.div>

             {/* Hidden printable receipt for POS (placed outside print:hidden block) */}
             <div className="hidden print:block fixed inset-0 bg-white p-8 text-black text-right relative" dir="rtl" id="pos-receipt-print">
                {/* Print Watermark */}
                {shopSettings?.showLogoInThermalHeader !== false && (
                   <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-[0.05] z-0 print:opacity-[0.05]">
                      <img src={logoBase64 || defaultAppIcon} alt="Watermark" className="w-64 h-64 object-contain rotate-[-15deg]" />
                   </div>
                )}

                <div className="text-center mb-6 max-w-sm mx-auto relative z-10">
                   {shopSettings?.showLogoInThermalHeader !== false && (
                      <img 
                        src={logoBase64 || defaultAppIcon} 
                        alt="Logo" 
                        className="w-20 h-20 object-contain mx-auto mb-2" 
                        onError={(e) => { e.currentTarget.src = defaultAppIcon; }} 
                      />
                   )}
                   {shopSettings?.showNameInThermalHeader !== false && (
                      <h2 className="text-xl font-black">{shopSettings?.shopName || 'الحسام فون'}</h2>
                   )}
                   <p className="text-xs">{shopSettings?.shopPhone && `تلفون: ${shopSettings.shopPhone}`}</p>
                   <p className="text-[10px] text-gray-550">{shopSettings?.shopAddress}</p>
                </div>
                <div className="flex justify-between text-xs mb-4 max-w-sm mx-auto">
                   <span>الفاتورة: {lastInvoice?.number}</span>
                   <span>التاريخ: {new Date(lastInvoice?.date || Date.now()).toLocaleString()}</span>
                </div>
                <div className="text-xs mb-4 max-w-sm mx-auto">
                   <span>العميل: {lastInvoice?.customer || 'عميل نقدي'}</span>
                </div>
                <hr className="border-black mb-4 max-w-sm mx-auto" />
                <table className="w-full text-xs max-w-sm mx-auto">
                   <thead>
                      <tr className="border-b border-black">
                         <th className="py-1 text-right">الصنف</th>
                         <th className="py-1 text-center">الكمية</th>
                         <th className="py-1 text-left">الإجمالي</th>
                      </tr>
                   </thead>
                   <tbody>
                      {lastInvoice?.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                           <td className="py-1">{item.name}</td>
                           <td className="py-1 text-center">{item.qty}</td>
                           <td className="py-1 text-left">{((item.qty || 0) * (item.price || 0)).toLocaleString()}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
                <hr className="border-black mt-4 mb-2 max-w-sm mx-auto" />
                 <div className="space-y-1 text-left max-w-sm mx-auto">
                    <div className="text-sm font-bold flex justify-between border-t border-[#000000] pt-1 mt-1">
                      <span>الإجمالي الكلي:</span>
                      
                      <span>{(lastInvoice?.total || 0).toLocaleString()} {getCurrencySymbol(lastInvoice?.currency)}</span>
                    </div>
                     {lastInvoice?.currencyEquivalents && Object.keys(lastInvoice.currencyEquivalents).length > 0 && shopSettings?.multiCurrencyActive && (
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-700 font-sans space-y-1">
                           <p className="font-extrabold text-right">المكافئ بالعملات الأجنبية:</p>
                           {Object.entries(lastInvoice.currencyEquivalents).map(([code, val]: any) => {
                              if (code === (shopSettings?.currency || 'ر.ي')) return null;
                              const currencySymbol = lastInvoice.currencyRatesAtSale?.find((c: any) => c.code === code)?.symbol || code;
                              return (
                                 <div key={code} className="flex justify-between items-center text-right font-sans" dir="rtl">
                                    <span className="text-right">{code}:</span>
                                    <span className="font-mono font-bold">{(val || 0).toLocaleString()} {currencySymbol}</span>
                                 </div>
                              );
                           })}
                        </div>
                     )}

                 </div>
                <div className="mt-8 text-center text-[10px] leading-relaxed max-w-sm mx-auto">
                   <p className="whitespace-pre-line">{shopSettings?.receiptNotes}</p>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Products Side */}
      <div className={`flex-1 flex flex-col gap-4 lg:gap-6 p-4 overflow-hidden ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex flex-col gap-3 bg-surface p-2 md:p-3 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
           <div className="flex items-center gap-2">
             <div className="relative flex-1 group">
               <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
               <input 
                 ref={searchInputRef}
                 type="text" 
                 placeholder="ابحث بالاسم أو الصوت..." 
                 className="w-full bg-background dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg pr-9 md:pr-10 pl-10 md:pl-12 py-2 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-right" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
               <button
                 type="button"
                 onClick={startSpeechRecognition}
                 className={`absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all shrink-0 cursor-pointer ${
                   isListening 
                     ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30' 
                     : 'text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800'
                 }`}
                 title="البحث الصوتي باللغة العربية"
               >
                 <Mic className="w-4 h-4" />
               </button>
             </div>
             <button 
               onClick={() => setShowBluetoothModal(true)}
               className="p-2 md:p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1 border border-emerald-500/20 shadow-sm shrink-0 cursor-pointer"
               title="إعدادات طابعة البلوتوث"
             >
               <Bluetooth className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
               <span className="hidden sm:inline text-[10px] font-bold">الطابعة</span>
             </button>
                           <button 
                onClick={() => setShowInlineScanner(!showInlineScanner)}
                className={`p-2 md:p-2.5 transition-all flex items-center gap-2 rounded-lg border shadow-sm cursor-pointer ${
                  showInlineScanner 
                    ? 'bg-secondary text-white border-secondary' 
                    : 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20'
                }`}
                title="ماسح الباركود بالكاميرا"
              >
                <Camera className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline text-[10px] font-bold">ماسح الكاميرا</span>
              </button>
            </div>


           
           <div className="flex items-center justify-between gap-3 overflow-hidden">
             <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-0.5 flex-nowrap min-w-0 flex-1">
                 <label className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 bg-surface border border-gray-100 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
                   <input 
                     type="checkbox" 
                     className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary rounded border-gray-300 dark:border-slate-700 focus:ring-primary"
                     checked={allowOverSell}
                     onChange={(e) => setAllowOverSell(e.target.checked)}
                   />
                   <span className="text-[8px] md:text-[9px] font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">تجاوز المخزون</span>
                 </label>
                 {categoriesData.map(cat => (
                   <button 
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                       selectedCategory === cat ? 'bg-primary text-white shadow-md' : 'bg-surface border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                     }`}
                   >
                     {cat}
                   </button>
                 ))}
             </div>
             <button 
               onClick={() => setShowMobileCart(true)}
               className="lg:hidden relative flex items-center justify-center p-2 bg-primary text-white rounded-lg transition-transform active:scale-90 shrink-0 cursor-pointer"
             >
               <ShoppingCart className="w-5 h-5" />
               {cart.length > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center border border-white">
                   {cart.length}
                 </span>
               )}
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
           {loading ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                  <div key={idx} className="bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-3 flex flex-col justify-between h-32 md:h-36">
                    <div className="space-y-2">
                      <div className="h-3.5 w-full bg-gray-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-3 w-16 bg-gray-150 dark:bg-slate-800 rounded"></div>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-gray-50/50 dark:border-slate-800/50">
                      <div className="h-4 w-12 bg-gray-200 dark:bg-slate-800 rounded"></div>
                      <div className="w-6 h-6 bg-gray-200 dark:bg-slate-750 rounded-full"></div>
                    </div>
                  </div>
                ))}</div>
           ) : filteredItems.length === 0 ? (
             <div className="h-full flex items-center justify-center text-gray-400">لا توجد منتجات</div>
           ) : (
              <>
             <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4_">
                {itemsToShow.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    onAdd={addToCart}
                  />
                ))}
                {false && itemsToShow.map((p) => (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addToCart(p)}
                    className="bg-surface p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/10 transition-all text-right flex flex-col min-h-[120px] md:min-h-[140px] h-full relative overflow-hidden group cursor-pointer"
                  >
                    <div className="flex-1 w-full flex gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-secondary font-bold bg-secondary/10 px-1.5 py-0.5 rounded-full uppercase">{p.category}</span>
                        <h4 className="font-bold text-primary mt-2 text-xs md:text-sm line-clamp-2 dark:text-foreground leading-snug">{p.name}</h4>
                        <p className="text-[9px] text-gray-400 mt-1">المخزون: {p.stock} {p.unit}</p>
                      </div>
                      <div className="w-11 h-11 md:w-12 md:h-12 bg-gray-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700 shrink-0 self-start mt-1">
                        <ProductImage src={p.imageUrl} alt={p.name} category={p.category} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 w-full">
                      <p className="text-secondary font-black text-xs md:text-sm">{(p.price || 0).toLocaleString()} <span className="text-[9px] opacity-70">{getCurrencySymbol(p.currency)}</span></p>
                      <div className="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>
                    {p.stock <= (p.minStock || 5) && p.stock > 0 && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 text-amber-500">
                        <AlertCircle className="w-3 h-3" />
                      </div>
                    )}
                    {p.stock <= 0 && <div className="absolute inset-0 bg-surface/80 flex items-center justify-center font-bold text-red-600 text-[10px] backdrop-blur-[1px]">نفذت الكمية</div>}
                  </motion.button>
                ))}
             </div>

             {filteredItems.length > visibleLimit && (
               <div className="flex justify-center pt-5 pb-7">
                 <button
                   type="button"
                   onClick={() => setVisibleLimit(prev => prev + 36)}
                   className="px-6 py-2.5 bg-[#E2A85C]/10 hover:bg-[#E2A85C]/15 text-[#E2A85C] border border-[#E2A85C]/20 hover:border-[#E2A85C]/35 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
                 >
                   عرض المزيد من الأصناف المباعة ({filteredItems.length - visibleLimit} صنف متبقي) 🚀
                 </button>
               </div>
             )}
              </>
           )}
        </div>
      </div>

      {/* Cart Side */}
      <div className={`fixed inset-0 lg:relative lg:inset-auto w-full lg:w-[400px] bg-surface border-r border-gray-200 dark:border-slate-800 flex flex-col p-4 lg:p-6 shadow-2xl transition-transform z-[110] lg:z-10 ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col gap-4 mb-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 relative flex-1">
                 <button 
                  onClick={() => setShowMobileCart(false)}
                  className="lg:hidden p-2 text-gray-400 hover:text-primary transition-colors"
                 >
                    <X className="w-6 h-6" />
                 </button>
                 <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/5 text-primary flex items-center justify-center rounded-lg md:rounded-xl font-bold">
                    ح
                 </div>
                 <div className="flex-1">
                   <h2 className="font-bold text-primary text-sm md:text-base">سلة المبيعات</h2>
                   <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => {
                          setCustomerType('guest');
                          setCustomerName('عميل نقدي');
                          setSelectedCustomerId(null);
                        }}
                        className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${customerType === 'guest' ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        زبون عابر
                      </button>
                      <button 
                        onClick={() => setCustomerType('registered')}
                        className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${customerType === 'registered' ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        عملاء مسجلين
                      </button>
                   </div>
                 </div>
              </div>
              <button className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-2 cursor-pointer bg-none border-none" onClick={() => setShowClearConfirm(true)}>
                 <Trash2 className="w-5 h-5" />
              </button>
           </div>

           <AnimatePresence>
             {showClearConfirm && (
               <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center border border-gray-100 dark:border-slate-800"
                 >
                   <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertCircle className="w-8 h-8" />
                   </div>
                   <h3 className="text-lg font-bold text-primary dark:text-white mb-2">تفريغ السلة؟</h3>
                   <p className="text-sm text-secondary dark:text-gray-400 mb-6">
                     هل أنت متأكد من حذف جميع الأصناف في السلة الحالية؟
                   </p>
                   <div className="flex gap-3">
                     <button 
                       onClick={() => { clearCart(); setShowClearConfirm(false); }}
                       className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors cursor-pointer"
                     >
                       نعم، تفريغ
                     </button>
                     <button 
                       onClick={() => setShowClearConfirm(false)}
                       className="flex-1 border border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 rounded-xl py-3 text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                     >
                       إلغاء
                     </button>
                   </div>
                 </motion.div>
               </div>
             )}
           </AnimatePresence>

           {customerType === 'registered' && (
             <div className="relative bg-background border border-gray-100 dark:border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-secondary/80" />
                   <div className="flex-1">
                      <input 
                        type="text" 
                        value={customerName === 'عميل نقدي' ? '' : customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setSelectedCustomerId(null);
                          setShowCustomerSearch(true);
                        }}
                        onFocus={() => setShowCustomerSearch(true)}
                        placeholder="ابحث عن عميل..."
                        className="text-xs bg-transparent border-none p-0 focus:ring-0 text-primary font-bold placeholder:text-gray-400 w-full text-right outline-none"
                      />
                      {selectedCustomerId && (
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-amber-500 font-bold justify-start">
                          <Star className="w-2.5 h-2.5 fill-current text-amber-500" />
                          <span>{customers.find(c => c.id === selectedCustomerId)?.points || 0} نقطة</span>
                        </div>
                      )}
                   </div>
                   {showCustomerSearch && (
                    <button 
                      className="text-gray-400 hover:text-primary p-1 cursor-pointer bg-none border-none"
                      onClick={() => setShowCustomerSearch(false)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                   )}
                </div>
                {showCustomerSearch && customerName && (
                  <div className="absolute top-full right-0 left-0 bg-surface border border-gray-150 dark:border-slate-800 rounded-xl shadow-2xl z-[150] max-h-48 overflow-y-auto mt-2 p-1">
                     <button 
                       className="w-full text-right px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between mb-1 text-secondary cursor-pointer bg-none border-none"
                       onClick={() => {
                         setShowCustomerSearch(false);
                       }}
                     >
                       <span className="opacity-60 text-[10px]">استخدام:</span>
                       <span className="font-bold">{customerName}</span>
                     </button>
                     {customers
                      .filter(c => (c.name || '').toLowerCase().includes((customerName || '').toLowerCase()) || (c.phone || '').includes(customerName || ''))
                      .map(c => (
                       <button 
                         key={c.id}
                         className="w-full text-right px-3 py-2 text-xs hover:bg-secondary/10 rounded-lg transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0 cursor-pointer bg-none"
                         onClick={() => {
                           setCustomerName(c.name);
                           setSelectedCustomerId(c.id);
                           setShowCustomerSearch(false);
                         }}
                       >
                          <div className="flex justify-between items-center">
                             <p className="font-bold text-primary">{c.name}</p>
                             <div className="flex items-center gap-1 text-[9px] text-amber-500 font-black">
                               <Star className="w-2.5 h-2.5 fill-current text-amber-500" />
                               <span>{c.points || 0}</span>
                             </div>
                          </div>
                          <p className="text-gray-450 font-mono text-[10px] text-right">{c.phone}</p>
                       </button>
                     ))}
                  </div>
                )}
             </div>
           )}
        </div>

        <div className="flex-1 relative flex flex-col min-h-0">


          {showInlineScanner && (


            <div className="absolute inset-x-0 top-0 z-50 p-1.5 bg-surface dark:bg-slate-900 border-b border-gray-150 dark:border-slate-800 shadow-2xl rounded-2xl mb-3">


              <ZxingBarcodeScanner 


                onScan={handleBarcodeScan} 


                onClose={() => setShowInlineScanner(false)} 


              />


            </div>


          )}



          <div className="flex-1 overflow-y-auto space-y-4 mb-6 scrollbar-thin scrollbar-thumb-gray-200">
           <AnimatePresence>
              {cart.map((i) => (
                <motion.div 
                  key={i.item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-gray-50/50 dark:bg-slate-900/50 p-2 rounded-xl"
                >
                   <div className="flex-1">
                      <p className="text-xs font-bold text-primary line-clamp-1">{i.item.name}</p>
                      <div className="flex items-center gap-1 group/price justify-start">
                        <input 
                           type="number"
                           step="any"
                           className="text-[10px] text-secondary font-bold bg-transparent border-none p-0 focus:ring-0 w-16 hover:bg-white dark:hover:bg-slate-805 rounded px-1 transition-colors text-right"
                           value={i.price === 0 ? '' : i.price}
                           onChange={(e) => updatePrice(i.item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                        <span className="text-[9px] text-gray-400">{getCurrencySymbol(i.item.currency)}</span>
                      </div>
                   </div>
                   <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 border border-gray-150 dark:border-slate-700">
                      <button 
                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded transition-all text-secondary active:scale-90 cursor-pointer border-none" 
                        onClick={() => updateQty(i.item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input 
                        type="number"
                        min="1"
                        className="w-8 text-center bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-primary font-mono appearance-none"
                        value={i.qty}
                        onChange={(e) => updateQty(i.item.id, e.target.value)}
                      />
                      <button 
                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded transition-all text-secondary active:scale-90 cursor-pointer border-none" 
                        onClick={() => updateQty(i.item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                   </div>
                   <button className="p-1 text-gray-300 hover:text-red-500 transition-colors cursor-pointer bg-none border-none" onClick={() => removeFromCart(i.item.id)}><X className="w-4 h-4" /></button>
                </motion.div>
              ))}
           </AnimatePresence>
           {cart.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 mt-12 opacity-40">
                <ShoppingCart className="w-12 h-12 text-[#8B5E3C]" />
                <p className="text-xs font-bold">السلة فارغة</p>
             </div>
           )}
        </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-slate-800 pt-4">
           <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
              <span>الإجمالي الفرعي</span>
              <span className="font-mono text-primary dark:text-foreground">{(total || 0).toLocaleString()} <span className="text-[9px]">{getCurrencySymbol(cart[0]?.item?.currency)}</span></span>
           </div>
           
           <div className="flex items-center justify-between text-2xl font-black text-primary dark:text-foreground">
              <span className="text-lg font-bold">الإجمالي</span>
              <span className="font-mono">{(total || 0).toLocaleString()} <span className="text-xs">{getCurrencySymbol(cart[0]?.item?.currency)}</span></span>
           </div>
           
           <div className="grid grid-cols-4 gap-1.5 mt-4">
              <button 
                onClick={() => setPaymentType('cash')}
                title="نقدي"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group cursor-pointer ${paymentType === 'cash' ? 'bg-primary/5 border-primary shadow-sm' : 'border-gray-150 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <Banknote className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'cash' ? 'text-primary' : 'text-green-600'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">نقدي</span>
              </button>
              <button 
                onClick={() => setPaymentType('debt')}
                title="دين"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group cursor-pointer ${paymentType === 'debt' ? 'bg-red-500/5 border-red-500' : 'border-gray-150 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <AlertCircle className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'debt' ? 'text-red-500' : 'text-orange-500'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">دين</span>
              </button>
              <button 
                onClick={() => setPaymentType('card')}
                title="بطاقة"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group cursor-pointer ${paymentType === 'card' ? 'bg-primary/5 border-primary' : 'border-gray-150 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <CreditCard className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'card' ? 'text-primary' : 'text-indigo-600'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">بطاقة</span>
              </button>
              <button 
                onClick={() => setPaymentType('wallet')}
                title="محفظة"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group cursor-pointer ${paymentType === 'wallet' ? 'bg-secondary/5 border-secondary' : 'border-gray-150 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <Wallet className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'wallet' ? 'text-secondary' : 'text-blue-500'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">محفظة</span>
              </button>
           </div>

           <div className="flex gap-2">
             {paymentType === 'wallet' && (
                <div className="flex-1">
                  <select 
                    className="w-full bg-secondary/5 border border-secondary/20 rounded-lg py-1.5 px-2 text-[10px] font-bold text-secondary outline-none appearance-none cursor-pointer text-center"
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value)}
                  >
                    {yemeniWallets.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
             )}
             <div className="flex-1">
                <select 
                  className="w-full bg-background dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-lg py-1.5 px-2 text-[10px] font-bold text-primary dark:text-foreground outline-none appearance-none cursor-pointer text-center"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                >
                  {paymentTermsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
             </div>
           </div>

           <button 
            disabled={cart.length === 0 || processing}
            onClick={completeSale}
            className="w-full bg-primary text-white py-3.5 md:py-4 rounded-xl font-bold hover:bg-opacity-95 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base cursor-pointer border-none"
           >
              {processing ? <RefreshCw className="w-5 h-5 animate-spin" /> : success ? <><CheckCircle className="w-5 h-5" /> تمت العملية</> : 'إتمام الفاتورة'}
           </button>
        </div>
      </div>
    </div>
  );
}
