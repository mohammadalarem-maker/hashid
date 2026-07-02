import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, Edit2, Check, X, RefreshCw, Calendar, FileText, Printer, Search, ArrowRightLeft, UserCheck, MessageCircle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { exportToPDF } from '../lib/pdfExport';
import { useConfirm } from '../lib/ConfirmContext';

export interface Debt {
  id: string;
  customerName: string;
  customerPhone: string;
  description: string;
  amountTotal: number;
  amountPaid: number;
  amountRemaining: number;
  createdAt: string;
  dueDate?: string;
}

export default function Debts() {
  const { shopSettings } = useData();
  const { confirm } = useConfirm();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters states
  const [searchQuery, setSearchQuery] = useState('');

  // Modals dialog actions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amountTotal, setAmountTotal] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [dueDate, setDueDate] = useState('');

  const [saving, setSaving] = useState(false);

  // Extra Modal for Quick Payments
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [quickPaymentAmount, setQuickPaymentAmount] = useState(0);

  useEffect(() => {
    // Read active debt list in real-time
    const unsub = onSnapshot(query(collection(db, 'debts'), orderBy('createdAt', 'desc')), (snap) => {
      setLoading(true);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Debt[];
      setDebts(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingDebt(null);
    setCustomerName('');
    setCustomerPhone('');
    setDescription('');
    setAmountTotal(0);
    setAmountPaid(0);
    setDueDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (target: Debt) => {
    setEditingDebt(target);
    setCustomerName(target.customerName);
    setCustomerPhone(target.customerPhone);
    setDescription(target.description);
    setAmountTotal(target.amountTotal);
    setAmountPaid(target.amountPaid);
    setDueDate(target.dueDate || '');
    setIsModalOpen(true);
  };

  const openPaymentModal = (target: Debt) => {
    setSelectedDebt(target);
    setQuickPaymentAmount(target.amountRemaining);
    setIsPaymentModalOpen(true);
  };

  const handleDelete = async (target: Debt) => {
    const confirmDel = await confirm({
      title: 'شطب وإلغاء الدين اليومي',
      message: `هل أنت متأكد تماماً من شطب وإلغاء دين العميل "${target.customerName}" بقيمة متبقية قدرها "${target.amountRemaining}"؟`,
      isDanger: true,
      confirmText: 'نعم، شطب نهائياً',
      cancelText: 'إلغاء تراجع'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'debts', target.id));
      notify.success('🗑️ تم شطب الغرامة والدين بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء محاولة شطب السجل.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!customerName.trim() || amountTotal <= 0) {
      notify.error('الرجاء تعبئة اسم العميل المعسر، وإجمالي مبلغ الدين أولاً.');
      setSaving(false);
      return;
    }

    const docId = editingDebt ? editingDebt.id : `debt_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري قيد المديونية الدفترية...');

    try {
      const parsedTotal = Number(amountTotal) || 0;
      const parsedPaid = Number(amountPaid) || 0;
      const parsedRemaining = Math.max(0, parsedTotal - parsedPaid);

      await setDoc(doc(db, 'debts', docId), {
        id: docId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        description: description.trim(),
        amountTotal: parsedTotal,
        amountPaid: parsedPaid,
        amountRemaining: parsedRemaining,
        createdAt: editingDebt ? editingDebt.createdAt : new Date().toISOString(),
        dueDate: dueDate || null,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingDebt ? 'تم تعديل المديونية بنجاح' : 'تم قيد المديونية بنجاح تالياً بالصندوق 🎉');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'تعذر قيد الدين.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const paymentVal = Number(quickPaymentAmount) || 0;
    if (paymentVal <= 0 || paymentVal > selectedDebt.amountRemaining) {
      notify.error(`عذراً، يجب أن يكون مبلغ السداد بين 1 و ${selectedDebt.amountRemaining}`);
      return;
    }

    setSaving(true);
    const toastId = notify.loading('جاري قيد سداد الدين وحفظ المقبوضات...');

    try {
      const nextPaid = selectedDebt.amountPaid + paymentVal;
      const nextRemaining = selectedDebt.amountTotal - nextPaid;

      // 1. Update the parent debt
      await setDoc(doc(db, 'debts', selectedDebt.id), {
        amountPaid: nextPaid,
        amountRemaining: nextRemaining,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Query or Create a payments sub-transaction doc
      const payId = `pay_${Math.floor(Math.random() * 90000) + 10000}`;
      await setDoc(doc(db, 'payments', payId), {
        id: payId,
        debtId: selectedDebt.id,
        customerName: selectedDebt.customerName,
        customerPhone: selectedDebt.customerPhone,
        amountPaid: paymentVal,
        date: new Date().toISOString(),
        createdBy: 'Admin Cashier'
      });

      notify.dismiss(toastId);
      notify.success(`💸 تم قيد سداد دفعة بـ ${(paymentVal || 0).toLocaleString()} ر.ي بنجاح، الباقي: ${(nextRemaining || 0).toLocaleString()} ر.ي`);
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'تعذر معالجة قيد المجموع.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintDebtInvoice = async (target: Debt) => {
    notify.info('جاري تحضير وتصدير كشف حساب الدين للطباعة والترحيل...');
    try {
      const configDoc = {
        title: 'كشف مديونية مستحقة الذمة',
        subtitle: `لصالح الزبون: ${target.customerName}`,
        total: target.amountRemaining,
        fields: [
          { label: 'رقم كشف حساب الذمة', value: target.id },
          { label: 'اسم العميل العسر', value: target.customerName },
          { label: 'رقم الجوال لتواصل العميل', value: target.customerPhone || 'غير متوفر' },
          { label: 'بيان وسحب قيمة الدين الكلية', value: (target.amountTotal || 0).toLocaleString() + ' ر.ي' },
          { label: 'المدفوع من حساب الزبون', value: (target.amountPaid || 0).toLocaleString() + ' ر.ي' },
          { label: 'المبلغ المتبقي المعلق ذمته', value: (target.amountRemaining || 0).toLocaleString() + ' ر.ي' },
          { label: 'ملاحظات', value: target.description || 'بلا ملاحظات' },
          { label: 'تاريخ الاستحقاق أو السداد', value: target.dueDate ? new Date(target.dueDate).toLocaleDateString() : 'مفتوح الحساب' }
        ],
        ...target,
        number: target.id || 'معلق',
        customer: target.customerName || 'عميل نقدي',
        paymentType: 'debt',
        items: [
          {
            name: `كشف حساب ديون - متبقي معلق ذمته (${target.description || 'بلا ملاحظات'})`,
            qty: 1,
            price: target.amountRemaining || 0
          }
        ]
      };
      await exportToPDF('', `debt_account_${target.customerName}`, false, configDoc, shopSettings);
    } catch (e: any) {
      notify.error('فشل تحضير المستند: ' + (e.message || e));
    }
  };

  // Filter List containing search
  const filteredDebts = debts.filter(target => 
    (target.customerName || '').includes(searchQuery) || 
    (target.customerPhone || '').includes(searchQuery)
  );

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Wallet className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة دفاتر الديون والدمم المعلقة</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تقييد المبيعات العاجلة، تتبع متبقيات مستحقات العملاء، وقيد سندات القبض</p>
           </div>
         </div>

         <button 
           onClick={openAddModal}
           className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer border-none shadow-xs"
           id="add-new-debt-btn"
         >
            <Plus className="w-4.5 h-4.5" /> تقييد دين جديد +
         </button>
      </div>

      {/* Filter and search */}
      <div className="flex bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl p-3 shadow-xs items-center gap-3 shrink-0">
        <label className="text-[10px] font-bold text-gray-400 shrink-0 block mr-1">بحث سريع:</label>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث باسم الزبون المدين أو برقم التلفون..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none text-right placeholder-gray-400 text-foreground"
          />
        </div>
      </div>

      {loading && debts.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
           <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
           <span className="text-xs text-gray-400 font-bold">جاري موازنة وتدقيق دفتر الديون...</span>
        </div>
      ) : debts.length === 0 ? (
        <div className="h-64 bg-surface rounded-2xl border border-gray-155 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <Wallet className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم يسجل أي عميل مديونية ذمة معلقة في الدفتر لغاية الوقت الحالي</p>
        </div>
      ) : (
        /* Debts List cards view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredDebts.map((target) => (
             <motion.div
               key={target.id}
               whileHover={{ y: -3 }}
               className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-5 relative overflow-hidden flex flex-col justify-between shadow-xs h-[255px]"
               id={`debt-card-${target.id}`}
             >
               {/* Due Date Indicator Badge if critical */}
               {target.amountRemaining > 0 && target.dueDate && (
                 <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                   new Date(target.dueDate).getTime() < Date.now() ? 'bg-red-50 text-red-650' : 'bg-amber-50 text-amber-650'
                 }`}>
                    ⏰ {new Date(target.dueDate).toLocaleDateString()}
                 </span>
               )}

               <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 border border-gray-100">
                        <Wallet className="w-6 h-6" />
                     </div>
                     <div className="min-w-0 text-right">
                        <h4 className="text-sm font-black text-gray-800 dark:text-white truncate">{target.customerName}</h4>
                        <span className="text-[10px] font-mono font-bold text-gray-405 block mt-0.5">{target.customerPhone || 'بلا هاتف'}</span>
                     </div>
                  </div>

                  {/* Pricing Balance Box info */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50/70 text-right select-none">
                     <div className="p-2 bg-gray-50 dark:bg-slate-800/15 rounded-xl">
                        <span className="text-[8.5px] font-bold text-gray-400 block mb-0.5">الحساب الكلي</span>
                        <span className="text-xs font-black text-primary dark:text-cyan-400 font-mono block truncate">{(target.amountTotal || 0).toLocaleString()}</span>
                     </div>

                     <div className="p-2 bg-gray-50 dark:bg-slate-800/15 rounded-xl">
                        <span className="text-[8.5px] font-bold text-gray-400 block mb-0.5">المدفوع سلفاً</span>
                        <span className="text-xs font-black text-emerald-600 font-mono block truncate">{(target.amountPaid || 0).toLocaleString()}</span>
                     </div>

                     <div className="p-2 bg-gray-50 dark:bg-slate-850/20 border border-red-500/20 rounded-xl">
                        <span className="text-[8.5px] font-bold text-red-500 block mb-0.5">باقي الذمة</span>
                        <span className="text-xs font-black text-red-600 font-mono block truncate">{(target.amountRemaining || 0).toLocaleString()}</span>
                     </div>
                  </div>
               </div>

               {/* Quick Payment Action / Sandbox Print invoice */}
               <div className="flex items-center justify-between border-t border-gray-50 dark:border-slate-800 pt-3 mt-4 shrink-0 font-sans">
                  <div className="flex items-center gap-1 flex-wrap">
                     <button
                       disabled={target.amountRemaining === 0}
                       onClick={() => openPaymentModal(target)}
                       className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1 text-white text-[10px] font-black rounded-lg cursor-pointer border-none"
                       id={`pay-debt-btn-${target.id}`}
                     >
                        <UserCheck className="w-3.5 h-3.5" /> سداد الذمة
                     </button>

                     {target.customerPhone && (
                        <>
                           <button
                             onClick={() => {
                                const msg = `مرحباً يا غالي ${target.customerName}، نأمل أنك بخير. تذكير لطيف من متجر الحسام فون 📱 بخصوص المتبقي من حسابك وهو (${(target.amountRemaining || 0).toLocaleString()} ر.ي). شاكرين لك تعاملك الراقي وثقتك بنا، ويسعدنا تشريفك لنا في المحل لأي استفسار أو سداد. يومك سعيد! ✨`;
                                
                                // Clean up phone number for WhatsApp URL
                                let cleaned = target.customerPhone.replace(/\D/g, '');
                                if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
                                else if (cleaned.startsWith('0')) cleaned = '967' + cleaned.substring(1);
                                else if (cleaned.length === 9 && (cleaned.startsWith('77') || cleaned.startsWith('73') || cleaned.startsWith('71') || cleaned.startsWith('70') || cleaned.startsWith('78'))) cleaned = '967' + cleaned;
                                
                                const url = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`;
                                window.open(url, '_blank');
                             }}
                             className="p-1 px-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[9px] font-black inline-flex items-center gap-1 cursor-pointer"
                             title="إرسال تذكير بالسداد عبر واتساب"
                           >
                              <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> واتساب
                           </button>

                           <button
                             onClick={() => {
                                const msg = `مرحباً يا غالي ${target.customerName}، نأمل أنك بخير. تذكير لطيف من متجر الحسام فون 📱 بخصوص المتبقي من حسابك وهو (${(target.amountRemaining || 0).toLocaleString()} ر.ي). شاكرين لك تعاملك الراقي وثقتك بنا، ويسعدنا تشريفك لنا في المحل لأي استفسار أو سداد. يومك سعيد! ✨`;
                                const url = `sms:${target.customerPhone}?body=${encodeURIComponent(msg)}`;
                                window.location.href = url;
                             }}
                             className="p-1 px-2.5 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 border border-sky-400/20 text-sky-700 dark:text-sky-400 rounded-lg text-[9px] font-black inline-flex items-center gap-1 cursor-pointer"
                             title="إرسال تذكير بالسداد عبر رسالة نصية SMS"
                           >
                              <MessageSquare className="w-3 h-3 text-sky-500 dark:text-sky-400" /> SMS
                           </button>
                        </>
                     )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                     <button
                       onClick={() => handlePrintDebtInvoice(target)}
                       className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-lg text-gray-400 border-none cursor-pointer"
                       title="تحميل كشف الحساب كملف PDF"
                       id={`print-debt-pdf-btn-${target.id}`}
                     >
                        <Printer className="w-4 h-4 text-[#8B5E3C]" />
                     </button>
                     <button
                       onClick={() => openEditModal(target)}
                       className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-lg text-gray-405 border-none cursor-pointer"
                     >
                        <Edit2 className="w-4 h-4 text-gray-450" />
                     </button>
                     <button
                       onClick={() => handleDelete(target)}
                       className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 border-none cursor-pointer"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
             </motion.div>
           ))}
        </div>
      )}

      {/* Debt Modal creation edit popup drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/50" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 p-5 space-y-4">
                <h3 className="font-black text-sm text-primary">
                   {editingDebt ? 'تعديل سجل المديونية الدفترية' : 'تقييد وقيد مديونية جديدة'}
                </h3>

                <form onSubmit={handleSave} className="space-y-4 text-right">
                   <div className="space-y-1 text-right">
                      <label className="text-[10px] font-bold text-gray-500 block mr-1">الاسم الكامل للعميل المدين:</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: يوسف عادل"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary text-right text-foreground"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">رقم هاتف الاتصال:</label>
                         <input
                           type="text"
                           placeholder="77XXXXXXX"
                           value={customerPhone}
                           onChange={(e) => setCustomerPhone(e.target.value)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold text-left outline-none focus:border-primary text-left font-mono text-foreground"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">تاريخ الاستحقاق (السداد):</label>
                         <input
                           type="date"
                           value={dueDate}
                           onChange={(e) => setDueDate(e.target.value)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">إجمالي مبلغ الدين:</label>
                         <input
                           type="number"
                           required
                           placeholder="0"
                           value={amountTotal}
                           onChange={(e) => setAmountTotal(Number(e.target.value) || 0)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">المدفوع من الحساب سلفاً:</label>
                         <input
                           type="number"
                           required
                           placeholder="0"
                           value={amountPaid}
                           onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                         />
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">بيان تفصيلي بقطع مبيعات الدين:</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="أدخل تفاصيل قطع المبيعات الناتجة عن الدين..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs outline-none text-right resize-none text-foreground"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <button type="submit" disabled={saving} className="w-full btn-primary text-xs font-black py-2.5 justify-center cursor-pointer border-none shadow-sm">
                         {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                         <span>تقييد الدين</span>
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Debt payment modal popup dialog */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedDebt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => !saving && setIsPaymentModalOpen(false)} className="absolute inset-0 bg-black/50" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden z-10 p-5 space-y-4">
                <h3 className="font-black text-sm text-primary">سند قبض وتنزيل دفعة من الدين</h3>
                <p className="text-[10px] text-gray-550 leading-relaxed">العميل: <strong className="text-secondary font-black">{selectedDebt.customerName}</strong>، المبلغ المتبقي: <strong>{(selectedDebt.amountRemaining || 0).toLocaleString()} ر.ي</strong></p>

                <form onSubmit={handleQuickPaymentSubmit} className="space-y-4 text-right">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">المبلغ المدفوع المقبوض صنفاً:</label>
                      <input
                        type="number"
                        required
                        max={selectedDebt.amountRemaining}
                        placeholder="ادخل الدفعة المقبوضة"
                        value={quickPaymentAmount}
                        onChange={(e) => setQuickPaymentAmount(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 justify-center cursor-pointer border-none shadow-sm">
                         {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                         <span>تقييد وتوليد سند القبض</span>
                      </button>
                      <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
