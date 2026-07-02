import React, { useState, useEffect } from 'react';
import { History, Search, RefreshCw, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { notify } from '../lib/notifications';

import { motion, AnimatePresence } from 'motion/react';
import { X, User, Calendar, DollarSign, Package, CreditCard, Tag } from 'lucide-react';

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userEmail: string;
  userName?: string;
  userId?: string;
  recordId?: string | null;
  collection?: string | null;
  details?: {
    total?: number;
    paymentType?: string;
    itemsCount?: number;
    customer?: string;
    tax?: number;
    items?: Array<{
      id: string;
      name: string;
      qty: number;
      price: number;
    }>;
    [key: string]: any;
  };
}

export default function ActivityLog() {
  const { shopSettings } = useData();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<Activity | null>(null);

  useEffect(() => {
    // Subscription of last 50 audit traceability logs
    const unsub = onSnapshot(query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setLoading(true);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
      setActivities(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDeleteLog = async (id: string) => {
    const confirmDel = window.confirm('هل تريد شطب هذا الإجراء المحفوظ من السجل الأمني؟');
    if (!confirmDel) return;
    try {
      await deleteDoc(doc(db, 'activities', id));
      notify.success('🗑️ تم شطب الإجراء من السجل المحفوظ بنجاح.');
      if (selectedLog?.id === id) {
        setSelectedLog(null);
      }
    } catch (err: any) {
      console.error(err);
      notify.error('خطأ أثناء شطب المستند: ' + err.message);
    }
  };

  const handleClearAllLogs = async () => {
    const confirmClear = window.confirm('تحذير: هل أنت متأكد تماماً من إفراغ وحذف جميع سجلات العمليات والرقابة الأمنية نهائياً؟');
    if (!confirmClear) return;
    const toastId = notify.loading('جاري تفريغ السجل الأمني...');
    try {
      const snap = await getDocs(collection(db, 'activities'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      notify.dismiss(toastId);
      notify.success('🧹 تم مسح وإفراغ سجل العمليات الأساسية بالكامل.');
      setSelectedLog(null);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error('فشل إفراغ السجل: ' + err.message);
    }
  };

  const filteredLogs = activities.filter(target => 
    (target.description || '').includes(searchQuery) || 
    (target.type || '').includes(searchQuery) ||
    (target.userEmail || '').includes(searchQuery)
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto text-right mb-16" dir="rtl">
       
       {/* Title */}
       <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                <History className="w-6 h-6" />
             </div>
             <div className="text-right">
                <h1 className="text-xl font-black text-gray-900 dark:text-white">سجل العمليات والرقابة الأمني</h1>
                <p className="text-xs text-gray-500 font-bold mt-0.5 font-sans">تتبع حركات البيع، شطب الفواتير، تحديث أسعار المخازن وتلقي التنبيهات الفنية</p>
             </div>
          </div>

          {activities.length > 0 && (
             <button
               onClick={handleClearAllLogs}
               className="py-1.5 px-3.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-xs font-black border border-red-100 cursor-pointer flex items-center gap-1 shrink-0"
             >
                <Trash2 className="w-3.5 h-3.5" /> مسح السجل بالكامل
             </button>
          )}
       </div>

       {/* Audit Filters bar */}
       <div className="flex bg-white dark:bg-slate-900 border border-gray-155 rounded-2xl p-3 shadow-xs items-center gap-3 shrink-0">
          <label className="text-[10px] font-bold text-gray-400 shrink-0 block mr-1">تصفية القائمة:</label>
          <div className="relative flex-1">
             <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
             <input
               type="text"
               placeholder="ابحث بقسيمة الوصف، الإجراء، أو بريد المسؤول الكاتب..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none text-right placeholder-gray-400 text-foreground"
             />
          </div>
       </div>

       {loading && activities.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
             <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
             <span className="text-xs text-gray-400 font-bold font-sans">جاري دمج أرشيف العمليات...</span>
          </div>
       ) : activities.length === 0 ? (
          <div className="h-64 bg-surface rounded-2xl border border-gray-150 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
             <History className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
             <p className="text-sm">لا يتوفر أي حركة مسجلة بسجل الرقابة لغاية الوقت الحالي</p>
          </div>
       ) : (
          <div className="bg-surface rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-xs">
             <div className="divide-y divide-gray-100 dark:divide-slate-800 text-right">
                {filteredLogs.map((log) => (
                   <div 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-850/10 transition-colors flex items-start gap-4 cursor-pointer"
                   >
                      <span className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-gray-100/30">
                         <Clock className="w-4.5 h-4.5 text-secondary dark:text-gray-350" />
                      </span>

                      <div className="flex-1 min-w-0 text-right font-sans">
                         <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10.5px] font-black text-gray-900 dark:text-white leading-normal line-clamp-1">{log.description}</span>
                            <span className="text-[9.5px] font-mono font-black text-gray-400 shrink-0">
                               {new Date(log.timestamp).toLocaleString()}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[9px] text-gray-405 font-medium mt-1">
                            <div className="flex items-center gap-3">
                               <span>البريد المقيد: <strong>{log.userEmail || 'البريد التلقائي لفرع الكاشير'}</strong></span>
                               <span className="px-2 py-0.5 bg-[#8B5E3C]/10 text-secondary rounded font-black text-[8px] uppercase">{log.type}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLog(log.id);
                              }}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md border-none cursor-pointer flex items-center justify-center z-10"
                              title="حذف هذا السطر"
                            >
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       )}

       {/* Advanced Interactive Process / Audit Detail Inspection Dialog */}
       <AnimatePresence>
          {selectedLog && (
             <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right" dir="rtl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-800 shadow-2xl flex flex-col font-sans"
                >
                   {/* Modal Header */}
                   <div className="p-5 border-b border-gray-100 dark:border-slate-850 flex justify-between items-center bg-gray-50/50 dark:bg-slate-850/20">
                      <div className="flex items-center gap-2.5">
                         <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <History className="w-5 h-5" />
                         </div>
                         <div>
                            <h3 className="text-sm font-black text-gray-900 dark:text-white">تفاصيل العملية والتحقق الأمني</h3>
                            <p className="text-[10px] text-gray-400 font-bold">معرّف المرجع: {selectedLog.id}</p>
                         </div>
                      </div>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
                      >
                         <X className="w-4 h-4" />
                      </button>
                   </div>

                   {/* Modal Body */}
                   <div className="p-6 space-y-6 flex-1 text-right">
                      {/* Detailed Description Alert block */}
                      <div className="p-4 bg-primary/5 dark:bg-slate-850/50 rounded-2xl border border-primary/10 dark:border-slate-800 space-y-2">
                         <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded font-bold">{selectedLog.type}</span>
                         <p className="text-xs font-black text-gray-800 dark:text-gray-100 leading-relaxed mt-1">
                            {selectedLog.description}
                         </p>
                      </div>

                      {/* Operation Personnel & Logging Metadata Grid */}
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-3 bg-gray-50/50 dark:bg-slate-850/30 rounded-xl space-y-1">
                            <span className="text-[9.5px] text-gray-400 font-black block">الموظف المسؤول:</span>
                            <div className="flex items-center gap-1.5 mt-1">
                               <User className="w-3.5 h-3.5 text-secondary" />
                               <span className="text-xs font-bold text-gray-700 dark:text-gray-255 truncate" title={selectedLog.userEmail}>
                                  {selectedLog.userName || selectedLog.userEmail}
                               </span>
                            </div>
                         </div>

                         <div className="p-3 bg-gray-50/50 dark:bg-slate-850/30 rounded-xl space-y-1">
                            <span className="text-[9.5px] text-gray-400 font-black block">التاريخ والوقت الفني:</span>
                            <div className="flex items-center gap-1.5 mt-1">
                               <Calendar className="w-3.5 h-3.5 text-secondary" />
                               <span className="text-xs font-bold font-mono text-gray-750 dark:text-gray-250">
                                  {new Date(selectedLog.timestamp).toLocaleString()}
                               </span>
                            </div>
                         </div>
                      </div>

                      {/* Itemized Sale detailed products table (IF Sale Invoice activity contains items) */}
                      {selectedLog.details?.items && selectedLog.details.items.length > 0 ? (
                         <div className="space-y-3">
                            <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-850 pb-2">
                               <Package className="w-4 h-4 text-primary" />
                               <span className="text-xs font-black text-gray-905 dark:text-gray-200">الأصناف والسلع المباعة في الفاتورة:</span>
                            </div>
                            <div className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                               <table className="w-full text-xs font-bold font-sans text-right">
                                  <thead>
                                     <tr className="bg-gray-50 dark:bg-slate-850/40 text-gray-550 border-b border-gray-100 dark:border-slate-850">
                                        <th className="p-3 text-right">اسم الموديل/السلعة</th>
                                        <th className="p-3 text-center w-16">الكمية</th>
                                        <th className="p-3 text-left w-24">سعر الوحدة</th>
                                        <th className="p-3 text-left w-24">الإجمالي</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50 dark:divide-slate-850/20 text-gray-700 dark:text-gray-200">
                                     {selectedLog.details.items.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-slate-850/10">
                                           <td className="p-3 text-right font-black text-gray-900 dark:text-white truncate max-w-[150px]" title={item.name}>
                                              {item.name}
                                           </td>
                                           <td className="p-3 text-center font-mono font-black text-secondary">
                                              {item.qty}
                                           </td>
                                           <td className="p-3 text-left font-mono">
                                              {item.price?.toLocaleString()} ر.ي
                                           </td>
                                           <td className="p-3 text-left font-mono text-gray-950 dark:text-white">
                                              {((item.price || 0) * (item.qty || 0)).toLocaleString()} ر.ي
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </div>
                      ) : null}

                      {/* Metadata property detail blocks (Total payment modes, customer targets etc.) */}
                      {selectedLog.details && Object.keys(selectedLog.details).some(k => k !== 'items') ? (
                         <div className="space-y-3">
                            <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-850 pb-2">
                               <Tag className="w-4 h-4 text-primary" />
                               <span className="text-xs font-black text-gray-805 dark:text-gray-200">الخصائص والقيم المقيدة للحدث:</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                               {selectedLog.details.total !== undefined && (
                                  <div className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30">
                                     <span className="text-[9px] text-gray-400 font-bold block">إجمالي القيمة المالية:</span>
                                     <span className="text-xs font-black text-amber-600 dark:text-amber-500 font-mono">
                                        {selectedLog.details.total?.toLocaleString()} ر.ي
                                     </span>
                                  </div>
                               )}
                               {selectedLog.details.paymentType && (
                                  <div className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30">
                                     <span className="text-[9px] text-gray-400 font-bold block">طريقة الدفع:</span>
                                     <span className="text-xs font-black text-[#8B5E3C] flex items-center gap-1 truncate">
                                        <CreditCard className="w-3 h-3 text-gray-400" />
                                        {selectedLog.details.paymentType}
                                     </span>
                                  </div>
                               )}
                               {selectedLog.details.customer && (
                                  <div className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30 col-span-1">
                                     <span className="text-[9px] text-gray-400 font-bold block">اسم العميل:</span>
                                     <span className="text-xs font-black text-gray-700 dark:text-gray-250 truncate block">
                                        {selectedLog.details.customer}
                                     </span>
                                  </div>
                               )}
                               {selectedLog.details.itemsCount !== undefined && (
                                  <div className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30">
                                     <span className="text-[9px] text-gray-400 font-bold block">عدد الأصناف:</span>
                                     <span className="text-xs font-mono font-black text-gray-700 dark:text-gray-250">
                                        {selectedLog.details.itemsCount} أصناف
                                     </span>
                                  </div>
                               )}
                               {selectedLog.details.tax !== undefined && selectedLog.details.tax > 0 && (
                                  <div className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30">
                                     <span className="text-[9px] text-gray-400 font-bold block">الرسوم/الضرائب:</span>
                                     <span className="text-xs font-mono font-black text-gray-700 dark:text-gray-250">
                                        {selectedLog.details.tax} ر.ي
                                     </span>
                                  </div>
                               )}
                               {Object.entries(selectedLog.details || {})
                                 .filter(([k]) => !['items', 'total', 'paymentType', 'customer', 'itemsCount', 'tax', 'number'].includes(k))
                                 .map(([key, val]) => {
                                    if (typeof val === 'object') return null;
                                    return (
                                       <div key={key} className="p-2.5 bg-gray-50/30 dark:bg-slate-850/20 rounded-xl space-y-0.5 border border-gray-100/30 truncate">
                                          <span className="text-[9px] text-gray-400 font-bold block truncate capitalize">{key}:</span>
                                          <span className="text-xs font-black text-gray-700 dark:text-gray-250 truncate block">
                                             {String(val)}
                                          </span>
                                       </div>
                                    );
                                 })
                               }
                            </div>
                         </div>
                      ) : null}
                   </div>

                   {/* Footer controls */}
                   <div className="p-4 border-t border-gray-100 dark:border-slate-850 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-850/10 rounded-b-3xl">
                      <button
                        onClick={() => handleDeleteLog(selectedLog.id)}
                        className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl font-black text-xs border border-red-100 cursor-pointer text-right flex items-center gap-1.5 shrink-0"
                      >
                         <Trash2 className="w-4 h-4" /> شطب هذا الإجراء من الأرشيف
                      </button>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="py-2 px-5 bg-gray-100 hover:bg-gray-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs border-none cursor-pointer"
                      >
                         إغلاق النافذة
                      </button>
                   </div>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
}
