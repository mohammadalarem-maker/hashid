import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, RefreshCw, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useData } from '../lib/DataContext';
import { useConfirm } from '../lib/ConfirmContext';

export default function CategoriesPage() {
  const { categoriesDocs, loading } = useData();
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (cat: any) => {
    const confirmDel = await confirm({
      title: 'حذف فئة المنتجات',
      message: `هل أنت متأكد من حذف الفئة "${cat.name}" تماماً؟ قد يؤثر هذا على طريقة تصفية الأصناف في الكاشير.`,
      isDanger: true,
      confirmText: 'نعم، حذف الفئة',
      cancelText: 'إلغاء'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'categories', cat.id));
      notify.success('🗑️ تم حذف فئة المنتجات بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ في عملية الحذف.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!name.trim()) {
      notify.error('يرجى تحديد اسم الفئة أولاً.');
      setSaving(false);
      return;
    }

    const docId = editingCategory ? editingCategory.id : `cat_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري حفظ الفئة...');

    try {
      // Unique validation key
      const q = query(collection(db, 'categories'), where('name', '==', name.trim()));
      const snap = await getDocs(q);
      
      // If we are adding and name already exists, or editing and name exists on other doc
      const exists = snap.docs.some(d => d.id !== docId);
      if (exists) {
        notify.dismiss(toastId);
        notify.error('❌ عذراً، فئة المنتجات هذه مسجلة بالفعل بالصندوق!');
        setSaving(false);
        return;
      }

      await setDoc(doc(db, 'categories', docId), {
        id: docId,
        name: name.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingCategory ? 'تم تحديث الفئة بنجاح' : 'تمت إضافة الفئة بنجاح 🎉');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'فشلت الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto text-right" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Tag className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">فئات ومجموعات المنتجات</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تصنيف منتجاتك (اكسسوارات، هواتف، كروت، صيانة) لتسريع الفرز في الكاشير</p>
           </div>
         </div>

         <button 
           onClick={openAddModal}
           className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer border-none"
           id="add-new-category-btn"
         >
            <FolderPlus className="w-4.5 h-4.5" /> إضافة فئة جديدة +
         </button>
      </div>

      {loading && categoriesDocs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-bold">جاري تحميل الفئات...</span>
        </div>
      ) : categoriesDocs.filter(c => c.name !== 'الكل').length === 0 ? (
        <div className="h-64 bg-surface rounded-2xl border border-gray-150 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <Tag className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم تسجل أي فئات لتصنيف المنتجات حتى الآن</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {categoriesDocs.filter(cat => cat.name !== 'الكل').map((cat, idx) => (
                 <div key={cat.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-colors flex items-center justify-between text-foreground">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 rounded bg-[#8B5E3C]/10 text-secondary text-xs font-black flex items-center justify-center">{idx + 1}</span>
                       <span className="text-xs font-black">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                       <button
                         onClick={() => openEditModal(cat)}
                         className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary transition-colors cursor-pointer"
                       >
                          <Edit2 className="w-4 h-4" />
                       </button>
                       <button
                         onClick={() => handleDelete(cat)}
                         className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer border-none"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* Modal Dialog add/edit Category */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/50" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden z-10 p-5 space-y-4">
               <h3 className="font-black text-sm text-primary">
                 {editingCategory ? 'تحديث فئة منتجات' : 'إضافة فئة منتجات جديدة'}
               </h3>
               
               <div className="space-y-1 text-right">
                  <label className="text-[10px] font-bold text-gray-400 block mr-1">اسم فئة المنتجات:</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="مثال: اكسسوارات هواتف" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-right text-foreground" 
                  />
               </div>

               <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button type="submit" onClick={handleSave} disabled={saving} className="w-full btn-primary text-xs font-black py-2.5 justify-center cursor-pointer border-none">
                     {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                     <span>حفظ الفئة</span>
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
