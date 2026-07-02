import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Trash2, 
  Check, 
  Lock, 
  Ban, 
  RefreshCw,
  Mail,
  UserCheck,
  Edit2,
  X,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { notify } from '../lib/notifications';

interface ERPUser {
  id: string; // Firebase Auth UID (if linked) or custom ID
  email: string;
  role: 'admin' | 'sales';
  status: 'active' | 'suspended';
  displayName: string;
  password?: string;
  phone?: string;
  lastLogin?: string;
}

export default function UsersPage() {
  const { user: currentLoggedUser, role: currentLoggedRole } = useAuth();
  
  const [users, setUsers] = useState<ERPUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Compose and Edit modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ERPUser | null>(null);

  // States fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'sales'>('sales');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Sync Users List in real-time
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setLoading(true);
      const listData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ERPUser[];
      setUsers(listData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('123456');
    setDisplayName('');
    setPhone('');
    setRole('sales');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (targetUser: ERPUser) => {
    // Deny modifying main developer owner faremazen3
    if (targetUser.email === 'faremazen3@gmail.com' && currentLoggedUser?.email !== 'faremazen3@gmail.com') {
      notify.error('❌ عذراً، لا تمتلك صلاحيات لتعديل بيانات مالك النظام الرئيسي!');
      return;
    }

    setEditingUser(targetUser);
    setEmail(targetUser.email);
    setPassword(targetUser.password || '123456');
    setDisplayName(targetUser.displayName);
    setPhone(targetUser.phone || '');
    setRole(targetUser.role);
    setStatus(targetUser.status);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (userToDelete: ERPUser) => {
    if (userToDelete.email === 'faremazen3@gmail.com') {
      notify.error('❌ لا يمكن حذف الحساب الجذري لمالك النظام الرئيسي!');
      return;
    }
    if (userToDelete.id === currentLoggedUser?.uid) {
      notify.error('❌ لا مفر من أنك لا تستطيع حذف حسابك الفعال أثناء استخدامه!');
      return;
    }

    const confirmDel = window.confirm(`هل أنت متأكد تماماً من حذف حساب وفصل مستخدم ${userToDelete.displayName}؟`);
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      notify.success('🗑️ تم حذف حساب وفصل المستخدم بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ في عملية حذف المستخدم.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const sanitizedEmail = email.trim().toLowerCase();

    if (!sanitizedEmail) {
      notify.error('الرجاء كتابة البريد الإلكتروني للمستخدم.');
      setSaving(false);
      return;
    }

    const docId = editingUser ? editingUser.id : `user_pre_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري معالجة وحفظ حساب المستخدم...');

    try {
      // Force non-duplicate check on additions
      if (!editingUser) {
        const checkQ = query(collection(db, 'users'), where('email', '==', sanitizedEmail));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
          notify.dismiss(toastId);
          notify.error('❌ هذا البريد الإلكتروني مستخدم بالفعل وحساب الصلاحيات مسجل باسم زميل آخر!');
          setSaving(false);
          return;
        }
      }

      const now = new Date().toISOString();
      const userData: any = {
        email: sanitizedEmail,
        password: password.trim(),
        displayName: displayName.trim(),
        phone: phone.trim(),
        role: role,
        status: status,
        updatedAt: now
      };

      if (!editingUser) {
        userData.createdAt = now;
        userData.id = docId;
      }

      // Create-Pre-register in Firebase Auth using temporary app instance to prevent logouts
      if (!editingUser) {
        let tempApp: any = null;
        try {
          const { initializeApp: initTempApp, deleteApp: delTempApp } = await import('firebase/app');
          const { getAuth: getTempAuth, createUserWithEmailAndPassword: createTempUser } = await import('firebase/auth');
          const firebaseConfig = (await import('../../firebase-applet-config.json')).default;
          
          tempApp = initTempApp(firebaseConfig, `TempUserReg_${Date.now()}`);
          const tempAuth = getTempAuth(tempApp);
          await createTempUser(tempAuth, sanitizedEmail, password.trim());
          await tempAuth.signOut();
          await delTempApp(tempApp);
          console.log(`Successfully pre-registered Auth user for ${sanitizedEmail}`);
        } catch (authRegErr: any) {
          console.warn("Auth registration deferred or failed (user might already exist):", authRegErr);
          if (tempApp) {
            const { deleteApp: delTempApp } = await import('firebase/app');
            try { await delTempApp(tempApp); } catch (e) {}
          }
        }
      }

      await setDoc(doc(db, 'users', docId), userData, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingUser ? '✏️ تم تحديث بيانات المستخدم بنجاح!' : '👤 تم تسجيل وإضافة المستخدم بنجاح تام! يرجى إبلاغه بكلمة المرور لتسجيل الدخول.');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'فشلت عملية معالجة الصلاحيات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center justify-between text-right">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Users className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة صلاحيات المستخدمين والموظفين</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تسجيل حسابات الموظفين، ضبط صلاحيات الكاشير، الإيقاف المؤقت أو تغيير كلمات مرور المبيعات</p>
           </div>
         </div>

         {currentLoggedRole === 'admin' && (
           <button 
             onClick={openAddModal}
             className="btn-primary text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer"
             id="add-new-user-btn"
           >
              <UserPlus className="w-4.5 h-4.5 font-bold" /> إضافة مستخدم جديد +
           </button>
         )}
      </div>

      {loading && users.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
           <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
           <span className="text-xs text-gray-400 font-bold">جاري تحميل خلاصة الموظفين...</span>
        </div>
      ) : (
        /* Users Iteration Table grid cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
           {users.map((item) => {
             const isOwner = item.email === 'faremazen3@gmail.com';
             const isSelf = item.id === currentLoggedUser?.uid;
             const isSales = item.role === 'sales';

             return (
               <motion.div
                 key={item.id}
                 whileHover={{ y: -4 }}
                 className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-5 relative overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all h-[240px]"
               >
                 {/* Visual Badge indicator depending on role to improve speed */}
                 <div className="absolute top-4 left-4 flex gap-1.5 z-10">
                   <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                     isOwner ? 'bg-amber-100 text-amber-700' : isSales ? 'bg-indigo-50 text-indigo-650' : 'bg-rose-50 text-rose-650'
                   }`}>
                      {isOwner ? 'مالك المجموع السحابي' : isSales ? 'مبيعات الكاشير' : 'مدير المبيعات'}
                   </span>

                   <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                     item.status === 'active' ? 'bg-emerald-50 text-emerald-650' : 'bg-red-50 text-red-650'
                   }`}>
                      {item.status === 'active' ? 'نشط ومفعل' : 'موقوف مؤقتاً'}
                   </span>
                 </div>

                 {/* User Identity Area */}
                 <div className="space-y-3 pt-4 select-none">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-primary/30 border border-gray-100/50">
                          <Users className="w-6 h-6 text-[#8B5E3C]" />
                       </div>
                       <div className="min-w-0 text-right">
                          <h4 className="text-sm font-black text-gray-800 dark:text-white truncate flex items-center gap-1.5 justify-start">
                             <span>{item.displayName}</span>
                             {isSelf && <span className="text-[10px] text-gray-400 font-bold">(أنت حالياً)</span>}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-gray-400 line-clamp-1 h-3">{item.email}</span>
                       </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-gray-50 dark:border-slate-850 text-xs font-semibold text-gray-500">
                       <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>تلفون: {item.phone || 'غير مسجل'}</span>
                       </div>
                       <div className="flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-gray-400" />
                          <span>كلمة المرور: <strong className="text-secondary dark:text-amber-500 font-mono text-sm">{item.password || '123456'}</strong></span>
                       </div>
                    </div>
                 </div>

                 {/* Actions */}
                 <div className="flex items-center justify-end gap-2 border-t border-gray-50 dark:border-slate-800 pt-3 mt-4 shrink-0">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-150/10 dark:bg-slate-800 dark:hover:bg-slate-750 text-secondary dark:text-gray-300 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                      id={`edit-user-btn-${item.id}`}
                    >
                       <Edit2 className="w-3 h-3" /> تعديل الصلاحية
                    </button>

                    {!isOwner && !isSelf && (
                      <button
                        onClick={() => handleDeleteUser(item)}
                        className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-500 rounded-lg transition-colors cursor-pointer border-none"
                        id={`delete-user-btn-${item.id}`}
                        title="حذف حساب الموظف وفصل صلاحياته تماماً"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                 </div>
               </motion.div>
             );
           })}
        </div>
      )}

      {/* Write Edit/Add Dialog Modals */}
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
                     <Shield className="w-5 h-5 font-bold" />
                     <h3 className="text-sm font-black">
                        {editingUser ? 'تحديث صلاحيات مستخدم' : 'تسجيل موظف ومستخدم جديد'}
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
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">الاسم الكامل للموظف:</label>
                     <input
                       type="text"
                       required
                       placeholder="مثال: أحمد عبد الله"
                       value={displayName}
                       onChange={(e) => setDisplayName(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold outline-none focus:border-primary text-right"
                     />
                  </div>

                  <div className="space-y-1 text-right">
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">البريد الإلكتروني (لتسجيل الدخول):</label>
                     <input
                       type="email"
                       required
                       disabled={!!editingUser}
                       placeholder="employee@alhosam.com"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold text-left outline-none focus:border-primary text-left font-mono disabled:opacity-60"
                     />
                     {!editingUser && (
                       <span className="text-[9px] text-gray-400 font-bold block mt-0.5">يمكنك استخدام بريد حقيقي أو بريد فرعي وهمي ينتهي بـ @alhosam.com</span>
                     )}
                  </div>

                  <div className="space-y-1 text-right">
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">رقم هاتف الموظف (اختياري):</label>
                     <input
                       type="text"
                       placeholder="77XXXXXXX"
                       value={phone}
                       onChange={(e) => setPhone(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold text-left outline-none focus:border-primary text-left font-mono"
                     />
                  </div>

                  <div className="space-y-1 text-right">
                     <label className="text-[10px] font-bold text-gray-500 block mr-1">كلمة مرور حساب النظام:</label>
                     <input
                       type="text"
                       required
                       placeholder="رقم أو رمز للتسجيل السريع"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold text-left outline-none focus:border-primary text-left font-mono"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                     <div className="space-y-1 text-right">
                        <label className="text-[10px] font-bold text-gray-500 block mr-1">مستوى الصلاحية:</label>
                        <select
                          value={role}
                          onChange={(e: any) => setRole(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-850 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer"
                        >
                           <option value="sales"> مبيعات / كاشير</option>
                           <option value="admin"> مدير مبيعات نظام</option>
                        </select>
                     </div>

                     <div className="space-y-1 text-right">
                        <label className="text-[10px] font-bold text-gray-500 block mr-1">حالة الحساب في المتجر:</label>
                        <select
                          value={status}
                          onChange={(e: any) => setStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-850 border border-gray-100 dark:border-slate-705 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer"
                        >
                           <option value="active">نشط وفعال</option>
                           <option value="suspended">موقوف مؤقتاً</option>
                        </select>
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
                        <span>حفظ بيانات الحساب</span>
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
