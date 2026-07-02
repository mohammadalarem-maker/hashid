import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Phone, 
  Search, 
  Plus, 
  ChevronRight, 
  RefreshCw,
  ShoppingBag,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';

export default function Customers() {
  const { t } = useTranslation();
  const { customers, loading, shopSettings } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [points, setPoints] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);

  const [saving, setSaving] = useState(false);

  // Filtered list
  const filteredCustomers = customers.filter(cust => 
    (cust.name || '').includes(searchQuery) || 
    (cust.phone || '').includes(searchQuery)
  );

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setPoints(0);
    setTotalPurchases(0);
    setIsModalOpen(true);
  };

  const openEditModal = (cust: any) => {
    setEditingCustomer(cust);
    setName(cust.name || '');
    setPhone(cust.phone || '');
    setPoints(cust.points || 0);
    setTotalPurchases(cust.totalPurchases || 0);
    setIsModalOpen(true);
  };

  const handleDelete = async (cust: any) => {
    const confirmDel = window.confirm(`هل أنت متأكد من حذف العميل "${cust.name}" تماماً من قاعدة البيانات؟`);
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'customers', cust.id));
      notify.success('🗑️ تم حذف العميل بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ في عملية الحذف.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!name.trim()) {
      notify.error('الرجاء كتابة اسم العميل أولاً.');
      setSaving(false);
      return;
    }

    const docId = editingCustomer ? editingCustomer.id : `cust_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري حفظ بيانات العميل...');

    try {
      // Force unique check on phone numbers
      if (!editingCustomer && phone.trim()) {
        const checkQ = query(collection(db, 'customers'), where('phone', '==', phone.trim()));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
          notify.dismiss(toastId);
          notify.error('❌ عذراً، رقم التلفون هذا مسجل مسبقاً باسم عميل آخر!');
          setSaving(false);
          return;
        }
      }

      await setDoc(doc(db, 'customers', docId), {
        id: docId,
        name: name.trim(),
        phone: phone.trim(),
        points: Number(points) || 0,
        totalPurchases: Number(totalPurchases) || 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingCustomer ? 'تم تحديث العميل بنجاح' : 'تمت إضافة العميل بنجاح 🎉');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'فشلت عملية حفظ العميل.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Users className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة قاعدة بيانات العملاء</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تسجيل العملاء الدائمين، تتبع إجمالي المبيعات، ونقاط الولاء الذكية المكتسبة</p>
           </div>
         </div>

         <button 
           onClick={openAddModal}
           className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer border-none"
           id="add-new-customer-btn"
         >
            <UserPlus className="w-4.5 h-4.5" /> إضافة عميل جديد +
         </button>
      </div>

      {/* Filter and search */}
      <div className="flex bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl p-3 shadow-xs items-center gap-3 shrink-0">
        <label className="text-[10px] font-bold text-gray-400 shrink-0 block mr-1">بحث سريع:</label>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث باسم العميل أو برقم التلفون..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none text-right placeholder-gray-400 text-foreground"
          />
        </div>
      </div>

      {loading && customers.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-bold">جاري تحميل سجل العملاء...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <Users className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم يتم العثور على أي عملاء يطابقون محددات البحث</p>
        </div>
      ) : (
        /* Customers Card Grids view representation */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
           {filteredCustomers.map((cust) => (
             <motion.div
               key={cust.id}
               whileHover={{ y: -3 }}
               className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-5 relative overflow-hidden flex flex-col justify-between shadow-xs h-[230px]"
             >
               {/* Points Indicator */}
               {(cust.points || 0) > 0 && (
                 <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold text-amber-600 bg-amber-500/10">
                    ⭐ {cust.points} نقطة
                 </span>
               )}

               <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-[#8B5E3C]/10 text-secondary flex items-center justify-center shrink-0 border border-gray-100">
                        <Users className="w-6 h-6 text-[#8B5E3C]" />
                     </div>
                     <div className="min-w-0 text-right">
                        <h4 className="text-sm font-black text-gray-800 dark:text-white truncate">{cust.name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-0.5">
                           <Phone className="w-3 h-3 shrink-0" />
                           <span>{cust.phone || 'غير مسجل'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50/70 select-none">
                     <div className="p-2.5 bg-gray-50 dark:bg-slate-800/20 border border-gray-100/50 dark:border-slate-800 rounded-xl text-right">
                        <span className="text-[9px] font-bold text-gray-400 block mb-0.5">المشتريات الإجمالية</span>
                        <div className="flex items-baseline gap-0.5 truncate">
                           <span className="text-xs font-black text-[#541919] dark:text-amber-500">{(cust.totalPurchases || 0).toLocaleString()}</span>
                           <span className="text-[8px] font-bold text-gray-400">{shopSettings?.currency || 'ر.ي'}</span>
                        </div>
                     </div>

                     <div className="p-2.5 bg-gray-50 dark:bg-slate-800/20 border border-gray-100/50 dark:border-slate-800 rounded-xl text-right">
                        <span className="text-[9px] font-bold text-gray-400 block mb-0.5">عدد النقاط</span>
                        <div className="flex items-baseline gap-0.5 truncate">
                           <span className="text-xs font-black text-emerald-600 dark:text-emerald-450">{cust.points || 0}</span>
                           <span className="text-[8px] font-bold text-gray-400">نقطة</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="flex items-center justify-end gap-2 border-t border-gray-50/70 pt-3 mt-4 shrink-0">
                  <button
                    onClick={() => openEditModal(cust)}
                    className="p-1 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-150/10 dark:bg-slate-800 dark:hover:bg-slate-750 text-secondary dark:text-gray-300 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                    id={`edit-customer-btn-${cust.id}`}
                  >
                     <Edit2 className="w-3 h-3" /> تعديل البيانات
                  </button>
                  <button
                    onClick={() => handleDelete(cust)}
                    className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-500 rounded-lg transition-colors cursor-pointer border-none"
                    id={`delete-customer-btn-${cust.id}`}
                    title="حذف العميل تماماً"
                  >
                     <Trash2 className="w-4 h-4" />
                  </button>
               </div>
             </motion.div>
           ))}
        </div>
      )}

      {/* Edit / Add customer modal dialog popup */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => !saving && setIsModalOpen(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />

             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 flex flex-col"
             >
               {/* Header */}
               <div className="bg-primary text-white p-4 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2">
                     <UserPlus className="w-5 h-5 font-bold" />
                     <h3 className="text-sm font-black text-white">
                        {editingCustomer ? 'تحديث بيانات العميل الدائم' : 'تسجيل عميل جديد'}
                     </h3>
                  </div>
                  {!saving && (
                     <button
                       onClick={() => setIsModalOpen(false)}
                       className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                     >
                        <X className="w-4 h-4 text-white" />
                     </button>
                  )}
               </div>

               {/* Form Content */}
               <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto no-scrollbar">
                  
                  <div className="space-y-1 text-right">
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">الاسم الكامل للعميل:</label>
                     <input
                       type="text"
                       required
                       placeholder="مثال: يوسف مازن فارع"
                       value={name}
                       onChange={(e) => setName(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold outline-none focus:border-primary text-right text-foreground"
                     />
                  </div>

                  <div className="space-y-1 text-right">
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">رقم الهاتف والتلفون:</label>
                     <input
                       type="text"
                       required
                       placeholder="77XXXXXXX"
                       value={phone}
                       onChange={(e) => setPhone(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold text-left outline-none focus:border-primary text-left font-mono text-foreground"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                     <div className="space-y-1 text-right">
                        <label className="text-[10px] font-bold text-gray-500 block mr-1">نقاط الولاء المكتسبة:</label>
                        <input
                          type="number"
                          value={points}
                          onChange={(e) => setPoints(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                        />
                     </div>

                     <div className="space-y-1 text-right">
                        <label className="text-[10px] font-bold text-gray-500 block mr-1">إجمالي مشترياته الكلية:</label>
                        <input
                          type="number"
                          value={totalPurchases}
                          onChange={(e) => setTotalPurchases(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold font-mono text-left outline-none focus:border-primary text-foreground"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                     <button
                       type="submit"
                       disabled={saving}
                       className="w-full bg-primary hover:bg-opacity-90 py-3 rounded-xl font-black text-xs text-white transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50 shadow-sm"
                     >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>حفظ بيانات العميل</span>
                     </button>
                     <button
                       type="button"
                       disabled={saving}
                       onClick={() => setIsModalOpen(false)}
                       className="w-full bg-gray-50 text-gray-550 hover:bg-gray-100 py-3 rounded-xl text-xs font-bold transition-all border border-gray-150 cursor-pointer disabled:opacity-50 text-center"
                     >
                        إلغاء الأمر
                     </button>
                  </div>

               </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
