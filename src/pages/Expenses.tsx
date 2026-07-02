import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Edit2, Check, X, RefreshCw, Upload, Image as ImageIcon, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { compressAndResizeToByteArray, uploadItemImage } from '../lib/imageStorage';
import { useData } from '../lib/DataContext';
import { useConfirm } from '../lib/ConfirmContext';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  receiptUrl?: string;
  createdBy: string;
}

export default function Expenses() {
  const { shopSettings } = useData();
  const { confirm } = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('مصاريف تشغيلية العامة');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => {
      setLoading(true);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
      setExpenses(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingExpense(null);
    setAmount(0);
    setCategory('مصاريف تشغيلية العامة');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setAmount(exp.amount);
    setCategory(exp.category);
    setDescription(exp.description);
    setDate((exp.date || '').split('T')[0]);
    setReceiptUrl(exp.receiptUrl || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (exp: Expense) => {
    const confirmDel = await confirm({
      title: 'حذف المصروف المالي',
      message: `هل أنت متأكد تماماً من حذف هذا المصروف بقيمة "${exp.amount}" وتفريغه من الموازنة؟`,
      isDanger: true,
      confirmText: 'نعم، احذفه',
      cancelText: 'تراجع'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'expenses', exp.id));
      notify.success('🗑️ تم شطب المصروف بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء شطب المصروف.');
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    const toastId = notify.loading('جاري معالجة ورفع صورة إيصال الصرف...');

    try {
      const uploadResult = await uploadItemImage(file, 'expense_receipt');
      if (uploadResult) {
        setReceiptUrl(uploadResult);
        notify.success('تم رفع وحفظ إيصال الصرف بنجاح! 🖼️');
      } else {
        throw new Error('فشل رفع الفاتورة.');
      }
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء الرفع.');
    } finally {
      notify.dismiss(toastId);
      setImageUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (amount <= 0 || !description.trim()) {
      notify.error('الرجاء تعبئة قيمة المصروف ووصف المنفعة المصروفة أولاً.');
      setSaving(false);
      return;
    }

    const docId = editingExpense ? editingExpense.id : `exp_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري قيد الصرف المحاسبي...');

    try {
      await setDoc(doc(db, 'expenses', docId), {
        id: docId,
        amount: Number(amount) || 0,
        category: category,
        description: description.trim(),
        date: new Date(date).toISOString(),
        receiptUrl: receiptUrl,
        createdBy: 'Admin / Cashier',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingExpense ? 'تم تعديل قيد المصروف بنجاح' : 'تم قيد وتسجيل المصروف التشغيلي بالصندوق 🎉');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'فشلت معالجة المصروف.');
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
              <DollarSign className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">إدار المصروفات والتكاليف التشغيلية</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تسجيل فواتير الكهرباء، إيجارات المتجر، رواتب ومستحقات الموظفين، والمصروفات النثرية</p>
           </div>
         </div>

         <button 
           onClick={openAddModal}
           className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer border-none shadow-xs"
           id="add-new-expense-btn"
         >
            <Plus className="w-4.5 h-4.5" /> قيد مصروف جديد +
         </button>
      </div>

      {loading && expenses.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
           <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
           <span className="text-xs text-gray-400 font-bold">جاري موازنة وتدقيق دفتر الصرف...</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="h-64 bg-surface rounded-2xl border border-gray-150 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <DollarSign className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم يتقيد أي بند صرف في الصندوق لغاية الوقت الحالي</p>
        </div>
      ) : (
        /* Expenses Table List view */
        <div className="bg-surface rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
              <table className="w-full text-right divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                 <thead className="bg-gray-50 dark:bg-slate-800/15 font-bold text-gray-500">
                    <tr>
                       <th className="p-4 pr-6">البند / المجموعة</th>
                       <th className="p-4">بيان ووصف المصروف</th>
                       <th className="p-4">قيمة المصروف الكلية</th>
                       <th className="p-4">تاريخ الصرف واليوم</th>
                       <th className="p-4">صورة الإيصال</th>
                       <th className="p-4 pl-6 text-left">التعديل</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-foreground">
                    {expenses.map((exp) => (
                       <tr key={exp.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-850/10 transition-colors">
                          <td className="p-4 pr-6">
                             <span className="px-2.5 py-1 bg-[#8B5E3C]/10 text-secondary rounded-lg font-black text-[10px]">
                                {exp.category}
                             </span>
                          </td>
                          <td className="p-4 font-black">{exp.description}</td>
                          <td className="p-4 font-black font-mono text-red-600">
                             -{(exp.amount || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                          </td>
                          <td className="p-4 font-mono text-gray-400">
                             {new Date(exp.date).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                             {exp.receiptUrl ? (
                                <a 
                                  href={exp.receiptUrl} 
                                  target="_blank" 
                                  ref={(el) => { if (el) el.setAttribute('referrerpolicy', 'no-referrer'); }}
                                  className="text-primary hover:underline font-bold text-[10px] flex items-center gap-1 shrink-0"
                                >
                                   <ImageIcon className="w-3.5 h-3.5" /> عرض الفاتورة
                                </a>
                             ) : (
                                <span className="text-gray-300 font-mono text-[9px]">لا يوجد</span>
                             )}
                          </td>
                          <td className="p-4 pl-6 text-left shrink-0">
                             <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(exp)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary border-none cursor-pointer"
                                >
                                   <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(exp)}
                                  className="p-1.5 hover:bg-red-50 text-red-550 rounded-lg border-none cursor-pointer"
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

      {/* Expense Modal Form Popup Drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/50" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 p-5 space-y-4">
                <h3 className="font-black text-sm text-primary">
                   {editingExpense ? 'تحديث قيد المصروف التشغيلي' : 'إثبات وقيد مصروف جديد بالصندوق'}
                </h3>

                <form onSubmit={handleSave} className="space-y-4 text-right">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">قيمة المصروف الصافي:</label>
                         <input
                           type="number"
                           required
                           placeholder="0"
                           value={amount}
                           onChange={(e) => setAmount(Number(e.target.value) || 0)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-foreground"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">المجموعة الاستهلاكية:</label>
                         <select
                           value={category}
                           onChange={(e) => setCategory(e.target.value)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer text-foreground"
                         >
                            <option value="مصاريف تشغيلية العامة">مصاريف تشغيلية العامة</option>
                            <option value="إيجارات وخدمات المحل">إيجارات وخدمات المحل</option>
                            <option value="كهرباء ومياه وانترنت">كهرباء ومياه وانترنت</option>
                            <option value="رواتب وأجور المبيعات">رواتب وأجور المبيعات</option>
                            <option value="صيانة أدوات ومعدات">صيانة أدوات ومعدات</option>
                            <option value="دعاية وترويج وتسويق">دعاية وترويج وتسويق</option>
                         </select>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">تاريخ عملية الصرف:</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-foreground"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">بيان وسبب قيد المصروف:</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="مثال: سداد فاتورة الكهرباء فرع مذبح كاشير لشهر أبريل..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs outline-none text-right resize-none text-foreground"
                      />
                   </div>

                   {/* Upload invoice attachment layout representation */}
                   <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl flex items-center gap-4 relative overflow-hidden">
                      <div className="w-16 h-16 rounded-xl bg-white border border-gray-150 overflow-hidden flex items-center justify-center shrink-0">
                         {receiptUrl ? (
                            <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                         ) : (
                            <ImageIcon className="w-6 h-6 text-gray-300" />
                         )}

                         {imageUploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                               <RefreshCw className="w-4 h-4 text-white animate-spin" />
                            </div>
                         )}
                      </div>

                      <div className="space-y-1 text-right flex-1 select-none z-10">
                         <h4 className="text-[10px] font-black text-primary">رفع أو تصوير إيصال الفاتورة</h4>
                         <p className="text-[8.5px] text-gray-400">يثبت الرقابة والموازنة لدفتر التدقيق.</p>
                         <label className="inline-block bg-white border border-gray-200 hover:border-primary px-3 py-1.5 rounded-lg text-primary text-[9px] font-black transition-all cursor-pointer">
                            اختر ملف الفاتورة 📸
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleImageSelect} 
                              className="hidden" 
                              disabled={imageUploading}
                            />
                         </label>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <button type="submit" disabled={saving} className="w-full btn-primary text-xs font-black py-2.5 justify-center cursor-pointer border-none shadow-sm">
                         {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                         <span>تقييد المصروف</span>
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
