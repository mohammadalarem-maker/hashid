import React, { useState, useEffect } from 'react';
import { BookOpen, FolderPlus, Plus, Edit2, Trash2, ArrowRightLeft, DollarSign, Wallet, Check, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { useConfirm } from '../lib/ConfirmContext';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | 'cogs';
  balance: number;
  description?: string;
}

export default function AccountingPage() {
  const { t } = useTranslation();
  const { shopSettings } = useData();
  const { confirm } = useConfirm();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | 'cogs'>('assets');
  const [initialBalance, setInitialBalance] = useState(0);
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Read accounts list in real-time
    const unsub = onSnapshot(query(collection(db, 'accounts'), orderBy('code', 'asc')), (snap) => {
      setLoading(true);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
      setAccounts(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setCode('');
    setName('');
    setType('assets');
    setInitialBalance(0);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setCode(acc.code);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(acc.balance);
    setDescription(acc.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (acc: Account) => {
    if (acc.balance !== 0) {
      notify.error('❌ عذراً، لا يمكن حذف حساب مالي يحمل رصيداً نشطاً!');
      return;
    }

    const confirmDel = await confirm({
      title: 'حذف الحساب الدفتري',
      message: `هل أنت متأكد تماماً من حذف حساب "${acc.name}" من شجرة الحسابات المحاسبية؟`,
      isDanger: true,
      confirmText: 'نعم، احذفه',
      cancelText: 'تراجع'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'accounts', acc.id));
      notify.success('🗑️ تم حذف الحساب المالي بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء حذف الحساب الدفتري.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!code.trim() || !name.trim()) {
      notify.error('الرجاء تعبئة كود الحساب واسمه أولاً.');
      setSaving(false);
      return;
    }

    const docId = editingAccount ? editingAccount.id : `acc_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري حفظ وتوثيق شجرة الحسابات...');

    try {
      // Duplicate code validator 
      if (!editingAccount) {
        const checkQ = query(collection(db, 'accounts'), where('code', '==', code.trim()));
        const snap = await getDocs(checkQ);
        if (!snap.empty) {
          notify.dismiss(toastId);
          notify.error('❌ كود الحساب هذا مسجل بالفعل لحساب ومجموعة أخرى!');
          setSaving(false);
          return;
        }
      }

      await setDoc(doc(db, 'accounts', docId), {
        id: docId,
        code: code.trim(),
        name: name.trim(),
        type: type,
        balance: Number(initialBalance) || 0,
        description: description.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingAccount ? 'تم تحديث الحساب بنجاح' : 'تم تدوين وإضافة الحساب المالي الجديد 🎉');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'تعذر معالجة الموازنة.');
    } finally {
      setSaving(false);
    }
  };

  // Safe type conversion translation labels
  const getAccountTypeLabel = (tType: string) => {
    switch (tType) {
      case 'assets': return 'الأصول (Assets)';
      case 'liabilities': return 'الالتزامات (Liabilities)';
      case 'equity': return 'حقوق الملكية (Equity)';
      case 'revenue': return 'الإيرادات (Revenue)';
      case 'expenses': return 'المصروفات (Expenses)';
      case 'cogs': return 'تكلفة الصنف (COGS)';
      default: return tType;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <BookOpen className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">دليل الحسابات وشجرة الحسابات الدفترية</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">ضبط الحسابات المالية العامة، إدارة الأصول السائلة، ومطابقة مركزك المالي</p>
           </div>
         </div>

         <button 
           onClick={openAddModal}
           className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer border-none"
           id="add-new-account-btn"
         >
            <Plus className="w-4.5 h-4.5" /> إضافة حساب مالي +
         </button>
      </div>

      {loading && accounts.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
           <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
           <span className="text-xs text-gray-400 font-bold">جاري ترحيل وتجهيز دفتر الأستاذ...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="h-64 bg-surface rounded-2xl border border-gray-150 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <BookOpen className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم تسجل أي حسابات في شجرتك المالية حتى الآن</p>
        </div>
      ) : (
        /* Accounts iteration list display */
        <div className="bg-surface rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
              <table className="w-full text-right divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                 <thead className="bg-gray-50 dark:bg-slate-800/10 font-bold text-gray-500">
                    <tr>
                       <th className="p-4 pr-6">كود الحساب</th>
                       <th className="p-4">اسم الحساب الجاري</th>
                       <th className="p-4">النوع / التصنيف</th>
                       <th className="p-4">الرصيد المحاسبي</th>
                       <th className="p-4">ملاحظات</th>
                       <th className="p-4 pl-6 text-left">الإجراءات</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-foreground">
                    {accounts.map((acc) => (
                       <tr key={acc.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-850/10 transition-colors">
                          <td className="p-4 pr-6 font-mono font-bold text-primary dark:text-amber-500">{acc.code}</td>
                          <td className="p-4 font-black">{acc.name}</td>
                          <td className="p-4">
                             <span className="px-2.5 py-1 bg-gray-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-gray-550 border border-gray-150/10">
                                {getAccountTypeLabel(acc.type)}
                             </span>
                          </td>
                          <td className="p-4 font-black font-mono">
                             {(acc.balance || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                          </td>
                          <td className="p-4 text-gray-450 truncate max-w-[150px]">{acc.description || 'بلا تفاصيل'}</td>
                          <td className="p-4 pl-6 text-left shrink-0">
                             <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(acc)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary border-none cursor-pointer"
                                  title="تعديل الحساب"
                                >
                                   <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(acc)}
                                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg border-none cursor-pointer"
                                  title="حذف الحساب"
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

      {/* Write Account Form Dialogs */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/50" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 p-5 space-y-4">
                <h3 className="font-black text-sm text-primary">
                   {editingAccount ? 'تعديل الحساب الدفتري' : 'إضافة حساب جديد لشجرة الحسابات'}
                </h3>

                <form onSubmit={handleSave} className="space-y-4 text-right">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">كود الحساب (Code):</label>
                         <input
                           type="text"
                           required
                           disabled={!!editingAccount}
                           placeholder="مثال: 1201"
                           value={code}
                           onChange={(e) => setCode(e.target.value)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold text-left font-mono outline-none text-foreground"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 block mr-1">نوع الحساب:</label>
                         <select
                           value={type}
                           onChange={(e: any) => setType(e.target.value)}
                           className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer text-foreground"
                         >
                            <option value="assets">الأصول</option>
                            <option value="liabilities">الالتزامات والخصوم</option>
                            <option value="equity">حقوق الملكية / رأس المال</option>
                            <option value="revenue">الإيرادات وعوائد المبيعات</option>
                            <option value="expenses">المصروفات والتشغيل</option>
                            <option value="cogs">تكلفة المبيعات (COGS)</option>
                         </select>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">اسم الحساب المالي:</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: صندوق الصرف الفرعي"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-right text-foreground"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">الرصيد الافتتاحي (الرصيد الحالي):</label>
                      <input
                        type="number"
                        required
                        placeholder="0"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-foreground"
                      />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block mr-1">ملاحظات أو بيان توضيحي:</label>
                      <textarea
                        rows={3}
                        placeholder="..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs outline-none text-right resize-none text-foreground"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <button type="submit" disabled={saving} className="w-full btn-primary text-xs font-black py-2.5 justify-center cursor-pointer border-none">
                         {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                         <span>حفظ الحساب الدفتري</span>
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
