import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Trash2, Printer, FileText, Share2, Clipboard, RefreshCw, Calendar, Mail, Wallet, AlertCircle, Layers, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, query, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useData } from '../lib/DataContext';
import { BluetoothPrinterService } from '../lib/bluetoothPrinter';
import { exportToPDF, exportInvoiceAsImage } from '../lib/pdfExport';
import { useConfirm } from '../lib/ConfirmContext';

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  purchasePrice?: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  date: string;
  currency?: string;
}

export default function SalesHistory() {
  const { shopSettings, customers } = useData();
  const { confirm } = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const getCurrencySymbol = (currencyCode: string | undefined): string => {
    return 'ر.ي';
  };

  const getExchangeRate = (currencyCode: string | undefined): number => {
    return 1;
  };

  const getInvoiceTotalInYer = (inv: Invoice | any): number => {
    return inv.total || 0;
  };

  const handleShareInvoiceAsImage = async (inv: Invoice) => {
    try {
      await exportInvoiceAsImage(inv, shopSettings, true);
    } catch (err: any) {
      console.error(err);
      notify.error('فشل مشاركة الفاتورة كصورة: ' + (err.message || err));
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'wallets' | 'debt'>('all');
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>('all');

  const walletFilters = [
    { key: 'all', label: 'كافة المحافظ 💳' },
    { key: 'M-Floos', label: 'الكريمي', match: 'الكريمي' },
    { key: 'Pyes', label: 'بيس', match: 'بيس' },
    { key: 'One Cash', label: 'ون كاش', match: 'ون كاش' },
    { key: 'Yousur', label: 'يسر', match: 'يسر' },
    { key: 'Shamil', label: 'شامل موني', match: 'شامل' },
    { key: 'Tadhamon', label: 'تضامن باي', match: 'تضامن' },
    { key: 'Mobily', label: 'موبايلي موني', match: 'موبايلي' },
    { key: 'Jeeb', label: 'جيب', match: 'جيب' },
    { key: 'Jawali', label: 'جوالي', match: 'جوالي' },
  ];

  // Selected Detail Panel
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const getPaymentLabel = (inv: Invoice | any) => {
    const method = inv.paymentMethod || inv.paymentType || 'cash';
    if (method === 'cash') return 'نقدي 💵';
    if (method === 'debt') return 'آجل (دين) 📝';
    if (method === 'card') return 'شبكة / بطاقة 💳';
    if (typeof method === 'string' && method.toLowerCase().startsWith('wallet:')) {
      const parts = method.split(':');
      return `محفظة: ${parts[1] ? parts[1].trim() : 'إلكترونية'}`;
    }
    if (method === 'wallet') return 'محفظة إلكترونية 📱';
    return method;
  };

  // Keep selectedInvoice synchronized in real-time with the central list state
  useEffect(() => {
    if (selectedInvoice) {
      const latest = invoices.find(inv => inv.id === selectedInvoice.id);
      if (latest) {
        setSelectedInvoice(latest);
      }
    }
  }, [invoices, selectedInvoice?.id]);

  useEffect(() => {
    // Read invoice list in real-time
    const unsub = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc')), (snap) => {
      setLoading(true);
      const data = snap.docs.map(doc => {
        const item = doc.data() as any;
        const matchingCustomer = customers.find(c => c.id === item.customerId);
        return {
          id: doc.id,
          ...item,
          customerName: item.customerName || item.customer || matchingCustomer?.name || 'عميل نقدي',
          customerPhone: item.customerPhone || item.phone || matchingCustomer?.phone || '',
          paymentMethod: item.paymentMethod || item.paymentType || 'cash'
        };
      }) as Invoice[];
      setInvoices(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [customers]);

  const handleDeleteInvoice = async (target: Invoice) => {
    const confirmDel = await confirm({
      title: 'شطب وإلغاء الفاتورة',
      message: `تحذير: هل أنت متأكد تماماً من شطب وحذف الفاتورة رقم "${target.number}" من قيود الصندوق نهائياً؟ قد يتسبب هذا بفروقات موازنة للأرباح الكلية.`,
      isDanger: true,
      confirmText: 'نعم، شطب نهائياً',
      cancelText: 'إلغاء'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'invoices', target.id));
      notify.success('🗑️ تم شطب الفاتورة وتفاصيلها بنجاح.');
      if (selectedInvoice?.id === target.id) {
        setSelectedInvoice(null);
      }
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'فشلت عملية الحذف.');
    }
  };

  const handlePrintBleReceiptDirectly = async (target: Invoice) => {
    notify.info('جاري إرسال تذكرة الفاتورة للطابعة الحرارية...');
    try {
      await BluetoothPrinterService.printInvoice(target, shopSettings?.shopName || 'الحسام فون', shopSettings);
      notify.success('تمت الطباعة آلياً بنجاح! 🎉');
    } catch (e: any) {
      console.error(e);
      notify.error(`خطأ في الطباعة: ${e.message || e}`);
    }
  };

  const handleDownloadPDFInvoice = async (target: Invoice) => {
    notify.info('جاري تصدير الفاتورة كملف PDF...');
    try {
      const invCurrencySymbol = getCurrencySymbol(target.currency);
      const configDoc = {
        ...target,
        title: 'فاتورة مبيعات جديدة',
        subtitle: `رقم الفاتورة: ${target.number}`,
        customer: target.customerName || 'عميل نقدي',
        paymentType: target.paymentMethod || 'cash',
        fields: [
          { label: 'رقم مرجع الفاتورة', value: target.number },
          { label: 'تاريخ وتوقيت المعاملة', value: new Date(target.date).toLocaleString() },
          { label: 'اسم العميل / المستلم', value: target.customerName },
          { label: 'طريقة الدفع والصندوق', value: target.paymentMethod },
          { label: 'قيمة المشتريات المجموع', value: (target.subtotal || 0).toLocaleString() + ' ' + invCurrencySymbol },
          { label: 'مبلغ الخصم أو التخفيض', value: (target.discount || 0).toLocaleString() + ' ' + invCurrencySymbol },
          { label: 'القيمة الصافية النهائية', value: (target.total || 0).toLocaleString() + ' ' + invCurrencySymbol }
        ]
      };
      
      const partsText = (target.items || []).map((it, idx) => `${idx + 1}- ${it.name} [الكمية: ${it.qty || 0}] x ${(it.price || 0).toLocaleString()} ${invCurrencySymbol}`);
      configDoc.fields.push({ label: 'تفاصيل الأصناف المبيوعة', value: partsText.join('\n') });

      await exportToPDF('', `invoice_${target.number}`, false, configDoc, shopSettings);
    } catch (e: any) {
       notify.error('فشل تحضير الفاتورة PDF: ' + (e.message || e));
    }
  };

  // Filter List contains search queries and tab filters
  const filteredInvoices = invoices.filter(target => {
    // 1. Text Search Filter
    const queryStr = searchQuery.trim().toLowerCase();
    const matchesSearch = !queryStr ||
      (target.number || '').toLowerCase().includes(queryStr) ||
      (target.customerName || '').toLowerCase().includes(queryStr) ||
      (target.customerPhone || '').toLowerCase().includes(queryStr);

    if (!matchesSearch) return false;

    // 2. Tab Filter
    const payMode = (target.paymentMethod || (target as any).paymentType || '').toLowerCase();
    
    // Check if debit invoice
    const isDebt = payMode === 'debt' || 
                   (target as any).status === 'unpaid' || 
                   ((target as any).paymentTerms && ((target as any).paymentTerms.includes('On Credit') || (target as any).paymentTerms.includes('دين')));

    if (activeTab === 'debt') {
      return isDebt;
    }

    if (activeTab === 'wallets') {
      const isWallet = payMode.startsWith('wallet');
      if (!isWallet) return false;

      if (selectedWalletFilter === 'all') return true;
      
      const filterConfig = walletFilters.find(w => w.key === selectedWalletFilter);
      if (filterConfig && filterConfig.match) {
        // Must match specified wallet string name
        const matchLower = filterConfig.match.toLowerCase();
        return (target.paymentMethod || (target as any).paymentType || '').toLowerCase().includes(matchLower);
      }
      return true;
    }

    return true;
  });

  return (
    <div className="space-y-6 text-right pb-20 md:pb-6" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <ShoppingCart className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-[#541919] dark:text-amber-500">أرشيف فواتير الكاشير والمبيعات</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">مراجعة المبيعات الإجمالية والمحصلة، تصفية الفواتير، وشطب أو إعادة طباعة الإيصالات المالية</p>
           </div>
         </div>
      </div>

      {/* Filter and search */}
      <div className="flex bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl p-3 shadow-xs items-center gap-3 shrink-0">
         <label className="text-[10px] font-bold text-gray-400 shrink-0 block mr-1">بحث سريع بالفواتير:</label>
         <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم الزبون، أو رقم التلفون..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-right placeholder-gray-400 text-gray-950 dark:text-gray-50"
            />
         </div>
      </div>

      {/* Smart Totals Grid */}
      {(() => {
        const totalSalesAll = invoices.reduce((sum, inv) => sum + getInvoiceTotalInYer(inv), 0);
        
        const totalSalesWallets = invoices
          .filter(inv => {
            const payMode = (inv.paymentMethod || (inv as any).paymentType || '').toLowerCase();
            return payMode.startsWith('wallet');
          })
          .reduce((sum, inv) => sum + getInvoiceTotalInYer(inv), 0);

        const totalSalesDebt = invoices
          .filter(inv => {
            const payMode = (inv.paymentMethod || (inv as any).paymentType || '').toLowerCase();
            const isDebt = payMode === 'debt' || 
                           (inv as any).status === 'unpaid' || 
                           ((inv as any).paymentTerms && ((inv as any).paymentTerms.includes('On Credit') || (inv as any).paymentTerms.includes('دين')));
            return isDebt;
          })
          .reduce((sum, inv) => sum + getInvoiceTotalInYer(inv), 0);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             {/* Total 1: All Invoices */}
             <div className="bg-[#541919]/5 dark:bg-amber-500/5 border border-[#541919]/10 dark:border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between text-right">
                <span className="text-[10px] sm:text-xs font-black text-gray-505 mb-1">📊 إجمالي مبيعات الفواتير الكلي (اليمني)</span>
                <span className="text-sm sm:text-md md:text-lg font-black text-[#541919] dark:text-amber-500 font-mono">
                   {totalSalesAll.toLocaleString()} {" "}
                   <span className="text-xs font-bold text-gray-400">ر.ي</span>
                </span>
             </div>

             {/* Total 2: E-Wallets */}
             <div className="bg-secondary/5 border border-secondary/10 p-4 rounded-2xl flex flex-col justify-between text-right">
                <span className="text-[10px] sm:text-xs font-black text-gray-505 mb-1">💳 إجمالي مبيعات المحافظ الإلكترونية</span>
                <span className="text-sm sm:text-md md:text-lg font-black text-secondary font-mono">
                   {totalSalesWallets.toLocaleString()} {" "}
                   <span className="text-xs font-bold text-gray-400">ر.ي</span>
                </span>
             </div>

             {/* Total 3: Deferred Debt */}
             <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl flex flex-col justify-between text-right">
                <span className="text-[10px] sm:text-xs font-black text-gray-550 mb-1">📝 إجمالي مبيعات الدين بالريال اليمني</span>
                <span className="text-sm sm:text-md md:text-lg font-black text-red-550 dark:text-red-400 font-mono">
                   {totalSalesDebt.toLocaleString()} {" "}
                   <span className="text-xs font-bold text-gray-400">ر.ي</span>
                </span>
             </div>
          </div>
        );
      })()}

      {/* 3 Main Tab Categories */}
      <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-gray-150 dark:border-slate-800">
         <button
           onClick={() => { setActiveTab('all'); setSelectedWalletFilter('all'); }}
           className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
             activeTab === 'all' 
               ? 'bg-primary text-white shadow-md shadow-primary/10' 
               : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-slate-800'
           }`}
         >
            <Layers className="w-4 h-4 shrink-0 animate-pulse" />
            <span>كافة الفواتير (الكل)</span>
         </button>
         
         <button
           onClick={() => setActiveTab('wallets')}
           className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
             activeTab === 'wallets' 
               ? 'bg-secondary text-white shadow-md shadow-secondary/10' 
               : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-slate-800'
           }`}
         >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>المحافظ الإلكترونية</span>
         </button>

         <button
           onClick={() => { setActiveTab('debt'); setSelectedWalletFilter('all'); }}
           className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
             activeTab === 'debt' 
               ? 'bg-red-500 text-white shadow-md shadow-red-500/15' 
               : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-slate-800'
           }`}
         >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>فواتير الدين (الآجل)</span>
         </button>
      </div>

      {/* Sub-tabs for Yemeni Wallets inside Digital Wallet group */}
      <AnimatePresence>
         {activeTab === 'wallets' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-2 bg-[#8C5E3C]/5 dark:bg-[#E2A85C]/5 border border-[#8C5E3C]/10 dark:border-[#E2A85C]/10 rounded-2xl p-3 text-right"
            >
               <h4 className="text-[10px] font-black text-[#541919] dark:text-amber-500 mb-1 leading-none mr-1 select-none">
                  فلترة فرعية حسب المحفظة الإلكترونية اليمنية المحددة:
               </h4>
               <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200" style={{ direction: 'rtl' }}>
                  {walletFilters.map((wallet) => (
                     <button
                       key={wallet.key}
                       onClick={() => setSelectedWalletFilter(wallet.key)}
                       className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black whitespace-nowrap transition-all border cursor-pointer ${
                         selectedWalletFilter === wallet.key
                           ? 'bg-[#8C5E3C] border-[#8C5E3C] text-white shadow-sm'
                           : 'bg-white dark:bg-slate-850 hover:bg-gray-50 border-gray-150 dark:border-slate-800 text-gray-500 dark:text-gray-400'
                       }`}
                     >
                        {wallet.label}
                     </button>
                  ))}
               </div>
            </motion.div>
         )}
      </AnimatePresence>

      {loading && invoices.length === 0 ? (
         <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
            <div className="w-6 h-6 border-2 border-[#8B5E3C] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400 font-bold">جاري تحميل خلاصة المبيعات والأرشيف...</span>
         </div>
      ) : filteredInvoices.length === 0 ? (
         <div className="h-64 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
            <ShoppingCart className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
            <p className="text-sm">لا تتوفر فواتير مبيعات مطابقة لبنود التصفية الحالية</p>
         </div>
      ) : (
         <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
               <table className="w-full text-right divide-y divide-gray-100 dark:divide-slate-850 text-xs">
                  <thead className="bg-gray-50/70 dark:bg-slate-850/30 font-bold text-gray-500">
                     <tr>
                        <th className="p-4 pr-6">رقم الفاتورة</th>
                        <th className="p-4">تاريخ ووقت العملية</th>
                        <th className="p-4">اسم الزبون</th>
                        <th className="p-4">رقم التلفون</th>
                        <th className="p-4">طريقة الدفع</th>
                        <th className="p-4 text-center">المبلغ الإجمالي</th>
                        <th className="p-4 text-center">التنازل والخصم</th>
                        <th className="p-4 text-center">المبلغ الصافي</th>
                        <th className="p-4 pl-6 text-left col-span-2">خيارات</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-850 text-foreground">
                     {filteredInvoices.map((inv) => (
                        <tr 
                          key={inv.id} 
                          onClick={() => setSelectedInvoice(inv)}
                          className="hover:bg-gray-50/50 dark:hover:bg-slate-850/10 cursor-pointer transition-colors"
                        >
                           <td className="p-4 pr-6 font-mono font-bold text-secondary dark:text-amber-500">{inv.number}</td>
                           <td className="p-4 font-mono text-gray-450">{(inv.date || '').substring(0, 16).replace('T', ' ')}</td>
                           <td className="p-4 font-black">{inv.customerName}</td>
                           <td className="p-4 font-mono text-gray-500">{inv.customerPhone || '—'}</td>
                           <td className="p-4">
                              <span className="px-2 py-0.5 bg-[#8C5E3C]/10 dark:bg-amber-500/10 text-[#8C5E3C] dark:text-amber-550 rounded-md font-black text-[10px] whitespace-nowrap">
                                 {getPaymentLabel(inv)}
                              </span>
                           </td>
                           <td className="p-4 font-bold text-gray-500 text-center font-mono">{(inv.subtotal || 0).toLocaleString()} {getCurrencySymbol(inv.currency)}</td>
                           <td className="p-4 font-bold text-red-500 text-center font-mono">
                              {inv.discount > 0 ? `-${inv.discount?.toLocaleString()} ${getCurrencySymbol(inv.currency)}` : '0'}
                           </td>
                           <td className="p-4 font-black text-emerald-600 dark:text-emerald-400 text-center font-mono">
                              {(inv.total || 0).toLocaleString()} {getCurrencySymbol(inv.currency)}
                           </td>
                           <td className="p-4 pl-6 text-left" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                 <button
                                   onClick={() => setSelectedInvoice(inv)}
                                   className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-850 rounded-lg text-secondary border-none cursor-pointer"
                                   title="عرض وتفصيل الفاتورة"
                                 >
                                    <FileText className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => handleDeleteInvoice(inv)}
                                   className="p-1.5 hover:bg-red-50 hover:text-red-650 rounded-lg text-red-500 border-none cursor-pointer"
                                   title="شطب الفاتورة نهائياً"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* Modern Receipt Detail Modal Overlay */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => setSelectedInvoice(null)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
             <motion.div 
               initial={{ opacity: 0, y: 35, scale: 0.98 }} 
               animate={{ opacity: 1, y: 0, scale: 1 }} 
               exit={{ opacity: 0, y: 35, scale: 0.98 }} 
               className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
             >
                {/* Header */}
                <div className="p-4 bg-gray-50 dark:bg-slate-850/40 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#8B5E3C]/10 rounded-lg flex items-center justify-center text-[#8B5E3C]">
                         <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-sm text-[#541919] dark:text-amber-500">مراجعة الفاتورة الإلكترونية الموثقة</span>
                   </div>
                   <button 
                     onClick={() => setSelectedInvoice(null)}
                     className="p-1 px-2.5 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg border-none cursor-pointer text-gray-500 text-xs font-black"
                   >
                     ✕
                   </button>
                </div>

                {/* Receipt Details Content */}
                <div className="flex-1 p-5 overflow-y-auto space-y-5 text-right font-sans">
                   <div className="border border-[#8B5E3C]/20 rounded-xl p-4 bg-[#8B5E3C]/5 space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                         <span className="text-[#8B5E3C]">رقم الفاتورة بالصندوق:</span>
                         <span className="text-gray-900 dark:text-white font-mono">{selectedInvoice.number}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                         <span className="text-gray-400">تاريخ وتوقيت المعاملة:</span>
                         <span className="text-gray-700 dark:text-gray-300 font-mono">
                            {new Date(selectedInvoice.date).toLocaleString()}
                         </span>
                      </div>
                      <div className="flex justify-between font-bold">
                         <span className="text-gray-400">طريقة الدفع والتسوية:</span>
                         <span className="text-[#8B5E3C] dark:text-[#E2A85C] font-black">{getPaymentLabel(selectedInvoice)}</span>
                      </div>
                   </div>

                   {/* Customer metadata */}
                   <div className="space-y-1.5 text-xs font-semibold">
                      <h4 className="text-[10px] uppercase tracking-wider text-gray-400 font-black mb-1">بيانات العميل المستلم</h4>
                      <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                         <span className="text-gray-400">اسم العميل المعتمد:</span>
                         <span className="text-gray-800 dark:text-gray-200 font-black">{selectedInvoice.customerName}</span>
                      </div>
                      {selectedInvoice.customerPhone && (
                         <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                            <span className="text-gray-400">رقم الهاتف:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-mono">{selectedInvoice.customerPhone}</span>
                         </div>
                      )}
                   </div>

                   {/* Invoice Items list */}
                   <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-gray-400 font-black">قائمة تفاصيل المشتريات المبيوعة بصك الضمان</h4>
                      <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-slate-850">
                         {(selectedInvoice.items || []).map((it, idx) => (
                            <div key={idx} className="p-3 bg-gray-50/50 dark:bg-slate-850/10 flex justify-between items-center text-xs">
                               <div className="space-y-0.5">
                                  <span className="font-extrabold text-gray-800 dark:text-gray-100 block">{it.name}</span>
                                  <div className="space-x-2 space-x-reverse text-[10.5px] text-gray-405 font-medium">
                                     <span>سعر القطعة: {(it.price || 0).toLocaleString()} {getCurrencySymbol(selectedInvoice.currency)}</span>
                                     <span>•</span>
                                     <span>الكمية: <strong className="text-secondary">{it.qty}</strong></span>
                                  </div>
                               </div>
                               <span className="font-mono font-black text-gray-900 dark:text-white">
                                  {((it.price || 0) * (it.qty || 0)).toLocaleString()} {getCurrencySymbol(selectedInvoice.currency)}
                                </span>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Financial summary calculations */}
                   <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-gray-400 font-semibold">
                         <span>المجموع الكلي للمبيعات قبل كسر الخصم:</span>
                         <span className="font-mono">{(selectedInvoice.subtotal || 0).toLocaleString()} {getCurrencySymbol(selectedInvoice.currency)}</span>
                      </div>
                      <div className="flex justify-between text-red-500 font-semibold">
                         <span>الخصم أو التنازل المكتسب للزبون:</span>
                         <span className="font-mono">-{ (selectedInvoice.discount || 0).toLocaleString() } {getCurrencySymbol(selectedInvoice.currency)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 font-semibold">
                         <span>إجمالي ضريبة المبيعات والقيمة المضافة:</span>
                         <span className="font-mono">{ (selectedInvoice.tax || 0).toLocaleString() } {getCurrencySymbol(selectedInvoice.currency)}</span>
                      </div>
                      <div className="flex justify-between font-black text-lg text-[#551A1A] dark:text-[#E2A85C] border-t border-dashed border-gray-205 dark:border-slate-800 pt-3">
                         <span>القيمة النهائية المودعة بالصندوق:</span>
                         <span className="font-mono">{(selectedInvoice.total || 0).toLocaleString()} {getCurrencySymbol(selectedInvoice.currency)}</span>
                      </div>
                   </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-850/40 flex items-center justify-between gap-2 shrink-0">
                   <div className="flex gap-2 flex-1">
                      <button
                        onClick={() => handlePrintBleReceiptDirectly(selectedInvoice)}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-black border-none cursor-pointer flex items-center justify-center gap-1 flex-1 active:scale-98"
                      >
                         <Printer className="w-4 h-4" /> طباعة إيصال
                      </button>
                      
                      <button
                        onClick={() => handleDownloadPDFInvoice(selectedInvoice)}
                        className="py-2.5 px-3 bg-primary hover:bg-opacity-95 text-white rounded-xl text-[10.5px] font-black border-none cursor-pointer flex items-center justify-center gap-1 flex-1 active:scale-98"
                      >
                         <FileText className="w-4 h-4" /> تصدير PDF
                       </button>
                       <button
                         onClick={() => handleShareInvoiceAsImage(selectedInvoice)}
                         className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-[10.5px] font-black border-none cursor-pointer flex items-center justify-center gap-1 flex-1 active:scale-98"
                       >
                          <Share2 className="w-4 h-4" /> مشاركة كصورة
                      </button>
                   </div>

                   <button
                     onClick={() => handleDeleteInvoice(selectedInvoice)}
                     className="py-2.5 px-4 bg-red-50 hover:bg-red-100 hover:text-red-700 text-red-600 rounded-xl text-[10.5px] font-black border border-red-100 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                   >
                      <Trash2 className="w-4 h-4" /> شطب الفاتورة
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
