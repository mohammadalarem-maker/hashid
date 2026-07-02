import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  Save, 
  MapPin, 
  Phone, 
  Type, 
  FileText, 
  Image as ImageIcon,
  DollarSign,
  Palette,
  RefreshCw,
  Sparkles,
  Camera,
  Moon,
  Sun,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Users,
  Scale,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Package,
  FolderOpen,
  Activity
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { compressAndResizeToByteArray, uploadItemImage } from '../lib/imageStorage';
import { useTranslation } from '../lib/translations';
import { useAuth } from '../lib/AuthContext';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';
import { exportToCSVInBackground } from '../lib/backgroundExporter';

export default function Settings() {
  const { t, language } = useTranslation();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // Backup and Exporting states
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingCollection, setExportingCollection] = useState<string | null>(null);

  // Form states
  const [shopName, setShopName] = useState('الحسام فون');
  const [shopPhone, setShopPhone] = useState('784707050 - 778915055');
  const [shopAddress, setShopAddress] = useState('صنعاء - مذبح - جوار فندق ضواحي صنعاء');
  const [receiptNotes, setReceiptNotes] = useState('صيانة وبموجة هواتف\nبيع جوالات - صيانة برمجة - اكسسوارات - ادوات تجميل - نسخ الافلام والمسلسلات - طباعة\nشكراً لتعاملكم معنا! البضاعة المباعة لا ترد ولا تستبدل بعد 24 ساعة.');
  const [currency, setCurrency] = useState('ر.ي');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState('https://i.imgur.com/gK9Jd74.png');
  const [notificationsMuted, setNotificationsMuted] = useState(() => {
    return localStorage.getItem('notifications_muted') === 'true';
  });
  const [interfaceLanguage, setInterfaceLanguage] = useState<'ar' | 'en'>('ar');
  const [multiCurrencyActive] = useState(false);
  
  // Invoice numbering and print options
  const [autoIncrementInvoice, setAutoIncrementInvoice] = useState(false);
  const [invoiceStartNumber, setInvoiceStartNumber] = useState(1001);
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [showLogoInThermalHeader, setShowLogoInThermalHeader] = useState(true);
  const [showNameInThermalHeader, setShowNameInThermalHeader] = useState(true);

  const [currencies, setCurrencies] = useState<any[]>([
    { code: 'YER', symbol: 'ر.ي', rate: 1, isBase: true }
  ]);

  useEffect(() => {
    // Listen for Settings in real-time
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      setLoading(true);
      if (snap.exists()) {
        const data = snap.data();
        setShopName(data.shopName || 'الحسام فون');
        setShopPhone(data.shopPhone || '784707050 - 778915055');
        setShopAddress(data.shopAddress || 'صنعاء - مذبح - جوار فندق ضواحي صنعاء');
        setReceiptNotes(data.receiptNotes || 'شكراً لزيارتكم! البضاعة المباعة لا ترد ولا تستبدل.');
        setCurrency(data.currency || 'ر.ي');
        setLogoUrl(data.logoUrl || 'https://i.imgur.com/gK9Jd74.png');
        if (data.language && (data.language === 'ar' || data.language === 'en')) {
          setInterfaceLanguage(data.language);
        }
        if (data.isDarkMode !== undefined) {
          setIsDarkMode(data.isDarkMode);
        }
        // Load invoice options
        setAutoIncrementInvoice(data.autoIncrementInvoice ?? false);
        setInvoiceStartNumber(data.invoiceStartNumber ?? 1001);
        setInvoicePrefix(data.invoicePrefix ?? 'INV-');
        setShowLogoInThermalHeader(data.showLogoInThermalHeader ?? true);
        setShowNameInThermalHeader(data.showNameInThermalHeader ?? true);
        setCurrencies([
          { code: data.currency || 'ر.ي', symbol: data.currency || 'ر.ي', rate: 1, isBase: true }
        ]);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Back up & Export Database procedures
  const handleExportAllJSON = async () => {
    setExportingAll(true);
    const toastId = notify.loading('جاري توليد نسخة احتياطية كاملة لكافة بيانات النظام...');
    try {
      const backupData: any = {
        exportedAt: new Date().toISOString(),
        system: "AlHusam Phone Smart POS",
        version: "1.0.0",
        data: {}
      };

      const collections = [
        'items',
        'categories',
        'invoices',
        'customers',
        'debts',
        'expenses',
        'accounts',
        'journal',
        'activities',
        'users'
      ];

      await Promise.all(collections.map(async (collName) => {
        try {
          const snap = await getDocs(collection(db, collName));
          backupData.data[collName] = snap.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
          }));
        } catch (collErr) {
          console.warn(`Could not export collection ${collName}:`, collErr);
          backupData.data[collName] = [];
        }
      }));

      // Download file as blob
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AlHusamPhone_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.dismiss(toastId);
      notify.success('✅ تم قيد وتحميل النسخة الاحتياطية الشاملة للجهاز بنجاح!');
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error('فشل في محاولة إتمام عمليات النسخ الاحتياطي التلقائي.');
    } finally {
      setExportingAll(false);
    }
  };

  const handleExportCollectionJSON = async (collName: string, collLabel: string) => {
    setExportingCollection(collName + '_json');
    const toastId = notify.loading(`جاري تصدير جدول ${collLabel} بصيغة JSON...`);
    try {
      const snap = await getDocs(collection(db, collName));
      const data = snap.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AlHusamPhone_${collName}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.dismiss(toastId);
      notify.success(`✅ تم تصدير وتحميل ملف ${collLabel} كنسخة JSON الحالية!`);
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(`فشل أثناء تصدير جدول ${collLabel}.`);
    } finally {
      setExportingCollection(null);
    }
  };

  const handleExportCollectionCSV = async (collName: string, collLabel: string) => {
    setExportingCollection(collName + '_csv');
    const toastId = notify.loading(`جاري معالجة وتصدير جدول ${collLabel} بصيغة CSV...`);
    try {
      const snap = await getDocs(collection(db, collName));
      const docsData = snap.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));

      if (docsData.length === 0) {
        notify.dismiss(toastId);
        notify.error(`لا تتوفر أية بيانات حالياً لجدول ${collLabel} لتصديرها.`);
        setExportingCollection(null);
        return;
      }

      // Gather unique keys
      const allKeysSet = new Set<string>();
      docsData.forEach(item => {
        const itemAny = item as any;
        Object.keys(itemAny).forEach(k => {
          if (typeof itemAny[k] !== 'function') {
            allKeysSet.add(k);
          }
        });
      });

      const headers = Array.from(allKeysSet);

      const rows = docsData.map(item => {
        const itemAny = item as any;
        return headers.map(key => {
          const val = itemAny[key];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') {
            if (val.seconds !== undefined) {
              return new Date(val.seconds * 1000).toISOString();
            }
            return JSON.stringify(val);
          }
          return String(val);
        });
      });

      // Background worker exporter
      exportToCSVInBackground(
        headers,
        rows,
        `AlHusamPhone_${collName}_backup_${new Date().toISOString().split('T')[0]}.csv`,
        () => {},
        () => {
          notify.dismiss(toastId);
          notify.success(`✅ تم تصدير وتحميل ملف ${collLabel} كجدول تفصيلي (CSV) بنجاح!`);
        },
        (err) => {
          notify.dismiss(toastId);
          notify.error(`فشل تصدير ملف CSV للجدول ${collLabel}: ${err}`);
        }
      );

    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(`فشل أثناء تحضير بيانات جدول ${collLabel} لتصديرها.`);
    } finally {
      setExportingCollection(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const toastId = notify.loading('جاري حفظ الإعدادات المؤسسية...');

    const updatedCurrencies = [
      { code: currency.trim(), symbol: currency.trim(), rate: 1, isBase: true }
    ];

    try {
      await setDoc(doc(db, 'settings', 'global'), {
        shopName: shopName.trim(),
        shopPhone: shopPhone.trim(),
        shopAddress: shopAddress.trim(),
        receiptNotes: receiptNotes.trim(),
        currency: currency.trim(),
        logoUrl: logoUrl.trim(),
        isDarkMode: isDarkMode,
        language: interfaceLanguage,
        multiCurrencyActive: false,
        currencies: updatedCurrencies,
        autoIncrementInvoice,
        invoiceStartNumber: Number(invoiceStartNumber),
        invoicePrefix: invoicePrefix.trim(),
        showLogoInThermalHeader,
        showNameInThermalHeader,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success('💾 تم حفظ كافة التفضيلات والإعدادات بنجاح!');
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'خطأ أثناء محاولة حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    const toastId = notify.loading('جاري معالجة ورفع لوجو المتجر...');

    try {
      const uploadResult = await uploadItemImage(file, 'logo_placeholder');
      if (uploadResult) {
        setLogoUrl(uploadResult);
        notify.success('تم رفع الصورة واعتمادها شعاراً للمتجر! 🖼️');
      } else {
        throw new Error('فشل رفع الشعار.');
      }
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء رفع لوجو المتجر.');
    } finally {
      notify.dismiss(toastId);
      setImageUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-bold">جاري تحميل إعدادات النظام...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 max-w-2xl mx-auto pb-20 md:pb-6 ${language === 'ar' ? 'text-right' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
         <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
            <Building className="w-6 h-6" />
         </div>
         <div className="text-right">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">{t('الإعدادات والخيارات العامة')}</h1>
            <p className="text-xs text-gray-500 font-bold mt-0.5">{t('تحرير اسم المتجر، شعار المؤسسة، العملة، وعناوين تذاكر طباعة إيصالات الكاشير')}</p>
         </div>
      </div>

      <form onSubmit={handleSave} className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-6 space-y-6 shadow-sm">
         
         {/* Shop Logo & Visual Header Upload */}
         <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-gray-50 dark:bg-slate-800/20 border border-gray-150/40 dark:border-slate-800 rounded-2xl relative overflow-hidden">
            <div className="absolute top-1/2 left-4 -translate-y-1/2 opacity-5 pointer-events-none">
               <Palette className="w-32 h-32 text-primary" />
            </div>

            <div className="relative shrink-0 w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 overflow-hidden flex items-center justify-center">
               <img 
                 src={logoUrl || defaultAppIcon} 
                 alt="Logo" 
                 className="w-full h-full object-cover" 
                 onError={(e) => { e.currentTarget.src = defaultAppIcon; }}
               />

               {imageUploading && (
                 <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                 </div>
               )}
            </div>

            <div className="space-y-2 text-center sm:text-right flex-1 select-none z-10 w-full">
               <h3 className="text-xs font-black text-primary">لوجو وشعار المؤسسة</h3>
               <p className="text-[10px] text-secondary">سيتم دمج وتضمين هذا الشعار تلقائيًا أعلى فواتير الـ PDF المطبوعة والمشتركة بالبريد.</p>
               
               <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                 <label className="text-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-primary px-3 py-1.5 rounded-lg text-primary text-[10px] sm:text-xs font-black transition-all cursor-pointer shadow-xs">
                    اختر صورة الشعار 🖼️
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect} 
                      className="hidden" 
                      disabled={imageUploading}
                    />
                 </label>
                 
                 {logoUrl && logoUrl !== 'https://i.imgur.com/gK9Jd74.png' && (
                   <button 
                     type="button" 
                     onClick={() => setLogoUrl('https://i.imgur.com/gK9Jd74.png')} 
                     className="text-[10px] sm:text-xs bg-red-50 hover:bg-red-100 text-red-650 px-3 py-1.5 rounded-lg border border-red-100 transition-all font-black"
                   >
                     إلغاء واستعادة الافتراضي
                   </button>
                 )}
               </div>
            </div>
         </div>

         {/* General Enterprise Info Content */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 flex items-center gap-1">
                  <Type className="w-3.5 h-3.5 text-secondary" /> اسم المتجر / المؤسسة
               </label>
               <input
                 type="text"
                 required
                 value={shopName}
                 onChange={(e) => setShopName(e.target.value)}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-bold border border-gray-100 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-right"
                 placeholder="الحسام فون"
               />
            </div>

            <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-secondary" /> أرقام التواصل والتلفون
               </label>
               <input
                 type="text"
                 required
                 value={shopPhone}
                 onChange={(e) => setShopPhone(e.target.value)}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-bold border border-gray-100 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-right"
                 placeholder="784707050 - 778915055"
               />
            </div>

            <div className="space-y-1 md:col-span-2">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-secondary" /> العنوان الجغرافي للمحل
               </label>
               <input
                 type="text"
                 required
                 value={shopAddress}
                 onChange={(e) => setShopAddress(e.target.value)}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-bold border border-gray-100 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-right"
                 placeholder="صنعاء - مذبح - جوار فندق ضواحي صنعاء"
               />
            </div>

            <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-secondary" /> اختصار العملة الافتراضية
               </label>
               <input
                 type="text"
                 required
                 value={currency}
                 onChange={(e) => setCurrency(e.target.value)}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-bold border border-gray-100 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-right"
                 placeholder="ر.ي"
               />
            </div>

            {/* Live visual preference panel theme mode selector */}
            <div className="space-y-1">
               {/* System Language Selector */}
               {(() => {
                 return (
                   <div className="space-y-1 mb-2">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 mb-1">{t('لغة واجهة النظام')}</span>
                      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setInterfaceLanguage('ar')}
                          className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                            interfaceLanguage === 'ar' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-xs' : 'text-gray-550 dark:text-gray-450'
                          }`}
                        >
                          🌍 {t('العربية')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setInterfaceLanguage('en')}
                          className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                            interfaceLanguage === 'en' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-xs' : 'text-gray-550 dark:text-gray-450'
                          }`}
                        >
                          🇺🇸 {t('الإنجليزية')}
                        </button>
                      </div>
                   </div>
                 );
               })()}

               <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 mb-1">{t('الوضع والمظهر الافتراضي')}</span>
               <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                 <button
                   type="button"
                   onClick={() => setIsDarkMode(false)}
                   className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                     !isDarkMode ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-xs' : 'text-gray-550 dark:text-gray-450'
                   }`}
                 >
                   <Sun className="w-3.5 h-3.5" /> {t('المظهر الفاتح الدافئ')}
                 </button>
                 <button
                   type="button"
                   onClick={() => setIsDarkMode(true)}
                   className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                     isDarkMode ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-xs' : 'text-gray-550 dark:text-gray-450'
                   }`}
                 >
                   <Moon className="w-3.5 h-3.5" /> {t('المظهر الداكن الفخم')}
                 </button>
               </div>
            </div>

            {/* Dynamic Notifications Preferences */}
            <div className="space-y-1 md:col-span-2 border-t border-gray-150/50 dark:border-slate-800/80 pt-4">
               <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 mb-1">🛎️ {t('إشراف وإدارة الإشعارات الفورية')}</span>
               <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                 <button
                   type="button"
                   id="enable-notifications-btn"
                   onClick={() => {
                     setNotificationsMuted(false);
                     localStorage.setItem('notifications_muted', 'false');
                     notify.success('🔔 تم تفعيل التنبيهات السحابية بنجاح!');
                   }}
                   className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-black transition-all border-none cursor-pointer ${
                     !notificationsMuted ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-550 dark:text-gray-450 hover:bg-gray-200/55 dark:hover:bg-slate-700/55'
                   }`}
                 >
                    <span>🔔 {t('تفعيل الإشعارات')}</span>
                 </button>
                 <button
                   type="button"
                   id="mute-notifications-btn"
                   onClick={() => {
                     setNotificationsMuted(true);
                     localStorage.setItem('notifications_muted', 'true');
                     notify.info('🔕 تم كتم تفعيل الإشعارات الصوتية والسحابية.');
                   }}
                   className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-black transition-all border-none cursor-pointer ${
                     notificationsMuted ? 'bg-rose-500 text-white shadow-xs' : 'text-gray-550 dark:text-gray-450 hover:bg-gray-200/55 dark:hover:bg-slate-700/55'
                   }`}
                 >
                    <span>🔕 {t('كتم الإشعارات')}</span>
                  </button>
               </div>
               <p className="text-[10px] text-gray-400 font-bold mr-1 mt-1 leading-relaxed">
                 {notificationsMuted 
                   ? t('وضع الميوت مفعل: لن تستقبل تنبيهات أو أصوات عند نقص مخازن الأصناف أو موازنة سلف الديون.') 
                   : t('إشعارات النظام نشطة الآن: ستستقبل تنبيهات سحابية مباشرة للأصناف وأيام سداد النقد.')}
               </p>
            </div>

            <div className="space-y-1 md:col-span-2">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-secondary" /> {t('ملاحظات تذيلية وشروط الفاتورة (ملاحظات الكاشير)')}
               </label>
               <textarea
                 required
                 rows={4}
                 value={receiptNotes}
                 onChange={(e) => setReceiptNotes(e.target.value)}
                 className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-bold border border-gray-100 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-right resize-none leading-relaxed"
                 placeholder={t('أية بنود أو شروط تظهر تذيلية في إيصال وقسيمة البيع...')}
               />
            </div>
         </div>

         
          {/* Invoice Auto-Increment & Thermal Header Settings */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 space-y-4 animate-fade-in text-right">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                   <FileText className="w-4 h-4" />
                </div>
                <div className="text-right">
                   <h3 className="text-sm font-black text-gray-900 dark:text-white font-sans">إعدادات ترقيم وطباعة الفواتير</h3>
                   <p className="text-[10px] text-gray-550 font-bold font-sans">التحكم في الترقيم التلقائي للفواتير وإعدادات ترويسة إيصالات الكاشير</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 dark:bg-slate-900/50 rounded-2xl border border-gray-150/50 dark:border-slate-800/80 p-4" dir="rtl">
                {/* 1. Toggle Auto Increment */}
                <div className="flex items-center justify-between p-2 md:col-span-2 border-b border-gray-150/40 dark:border-slate-800 pb-3">
                   <div className="text-right col-span-2">
                      <span className="text-xs font-black text-gray-800 dark:text-gray-200 block">تفعيل الترقيم التلقائي للفواتير (Auto-Increment)</span>
                      <span className="text-[10px] text-gray-400 font-bold block">سيقوم النظام بتوليد أرقام تسلسلية تصاعدية للفواتير تلقائياً بدلاً من التوليد العشوائي</span>
                   </div>
                   <button
                      type="button"
                      onClick={() => setAutoIncrementInvoice(!autoIncrementInvoice)}
                      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all border-none outline-none shrink-0 ${
                        autoIncrementInvoice ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-800'
                      }`}
                   >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                        autoIncrementInvoice ? '-translate-x-6' : 'translate-x-0'
                      }`} />
                   </button>
                </div>

                {autoIncrementInvoice && (
                   <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 border-b border-gray-150/40 dark:border-slate-800 pb-3 font-sans"
                   >
                      {/* Prefix */}
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 text-right">بادئة رقم الفاتورة (Prefix)</label>
                         <input
                            type="text"
                            value={invoicePrefix}
                            onChange={(e) => setInvoicePrefix(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-bold border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-primary text-right"
                            placeholder="INV-"
                         />
                      </div>
                      
                      {/* Start Number */}
                      <div className="space-y-1">
                         <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mr-1 text-right">رقم البداية للعد التلقائي</label>
                         <input
                            type="number"
                            min="1"
                            value={invoiceStartNumber}
                            onChange={(e) => setInvoiceStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-bold border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-primary text-center font-mono"
                         />
                      </div>
                   </motion.div>
                )}

                {/* 2. Show Logo in Thermal Header */}
                 <div className="flex items-center justify-between p-2">
                    <div className="text-right">
                       <span className="text-xs font-black text-gray-800 dark:text-gray-200 block">عرض شعار المحل في الفاتورة الحرارية</span>
                       <span className="text-[10px] text-gray-400 font-bold block">إدراج أو إخفاء شعار/لوجو المحل أعلى الفاتورة المطبوعة</span>
                    </div>
                    <button
                       type="button"
                       onClick={() => setShowLogoInThermalHeader(!showLogoInThermalHeader)}
                       className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all border-none outline-none shrink-0 ${
                         showLogoInThermalHeader ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-800'
                       }`}
                    >
                       <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                         showLogoInThermalHeader ? '-translate-x-6' : 'translate-x-0'
                       }`} />
                    </button>
                 </div>

                 {/* 3. Show Name in Thermal Header */}
                 <div className="flex items-center justify-between p-2">
                    <div className="text-right">
                       <span className="text-xs font-black text-gray-800 dark:text-gray-200 block">عرض اسم المحل في الفاتورة الحرارية</span>
                       <span className="text-[10px] text-gray-400 font-bold block">إدراج أو إخفاء اسم المحل أعلى الفاتورة المطبوعة</span>
                    </div>
                    <button
                       type="button"
                       onClick={() => setShowNameInThermalHeader(!showNameInThermalHeader)}
                       className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all border-none outline-none shrink-0 ${
                         showNameInThermalHeader ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-800'
                       }`}
                    >
                       <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                         showNameInThermalHeader ? '-translate-x-6' : 'translate-x-0'
                       }`} />
                    </button>
                 </div>
              </div>
           </div>

 <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-opacity-90 py-3 rounded-xl font-black text-xs text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 border-none"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ كافة التغييرات والتفضيلات 💾
            </button>
         </div>

      </form>

      {/* Backup and DB Recovery Section restricted to Admin Role */}
      {role === 'admin' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 p-6 space-y-6 shadow-sm mt-6 text-right"
          id="admin-backup-recovery-box"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 animate-pulse text-amber-600" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-black text-gray-900 dark:text-white">تصدير وحفظ النسخ الاحتياطية لقواعد البيانات</h3>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">تنزيل جداول العمل تلافياً لأي طارئ وضمان تخزينها خارج النظام</p>
              </div>
            </div>

            {/* Main export button */}
            <button
              type="button"
              onClick={handleExportAllJSON}
              disabled={exportingAll || exportingCollection !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#8B5E3C] hover:opacity-90 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all border-none"
            >
              {exportingAll ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileJson className="w-4 h-4 text-amber-200" />
              )}
              تصدير نسخة احتياطية شاملة (JSON) 📥
            </button>
          </div>

          {/* Individual collections grid */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 animate-bounce" /> تصدير وتنزيل جداول مخصصة للعمل (JSON / CSV):
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'items', label: 'المنتجات والمخزون المالي', icon: Package, color: 'text-blue-500 bg-blue-500/10' },
                { id: 'categories', label: 'فئات وأقسام الأصناف', icon: FolderOpen, color: 'text-indigo-500 bg-indigo-500/10' },
                { id: 'invoices', label: 'الفواتير والمبيعات اليومية', icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-500/10' },
                { id: 'customers', label: 'العملاء وحسابات المستفيدين', icon: Users, color: 'text-purple-500 bg-purple-500/10' },
                { id: 'debts', label: 'الديون الموقوفة والمديونيات', icon: Scale, color: 'text-rose-500 bg-rose-500/10' },
                { id: 'expenses', label: 'المصروفات والمشتريات التشغيلية', icon: Coins, color: 'text-amber-500 bg-amber-500/10' },
                { id: 'accounts', label: 'دليل الحسابات والأستاذ المالي', icon: Database, color: 'text-teal-500 bg-teal-500/10' },
                { id: 'journal', label: 'القيود اليومية العامة واليومية المساعدة', icon: FileText, color: 'text-orange-500 bg-orange-500/10' },
                { id: 'activities', label: 'سجلات عمليات وأنشطة الموظفين', icon: Activity, color: 'text-slate-500 bg-slate-500/10' },
                { id: 'users', label: 'إدارة المستخدمين وصلاحيات الحسابات', icon: ShieldAlert, color: 'text-red-500 bg-red-500/10' },
              ].map((coll) => {
                const IconComp = coll.icon;
                const isThisJsonLoading = exportingCollection === coll.id + '_json';
                const isThisCsvLoading = exportingCollection === coll.id + '_csv';
                const anyLoading = exportingAll || exportingCollection !== null;

                return (
                  <div
                    key={coll.id}
                    className="p-3 bg-gray-50/50 dark:bg-slate-800/25 border border-gray-150/40 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-gray-200 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${coll.color}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-gray-800 dark:text-gray-200">{t(coll.label)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* JSON single export */}
                      <button
                        type="button"
                        onClick={() => handleExportCollectionJSON(coll.id, coll.label)}
                        disabled={anyLoading}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 text-gray-600 dark:text-gray-400 hover:text-amber-600 text-[10px] rounded-lg font-black flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
                        title="تنزيل كملف JSON"
                      >
                        {isThisJsonLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                        ) : (
                          <Download className="w-3 h-3 text-amber-500" />
                        )}
                        JSON
                      </button>

                      {/* CSV single export */}
                      <button
                        type="button"
                        onClick={() => handleExportCollectionCSV(coll.id, coll.label)}
                        disabled={anyLoading}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-gray-600 dark:text-gray-400 hover:text-emerald-600 text-[10px] rounded-lg font-black flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
                        title="تنزيل كملف إكسل CSV"
                      >
                        {isThisCsvLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                        ) : (
                          <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
                        )}
                        CSV
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Secure Hint */}
          <div className="p-3 bg-amber-500/5 dark:bg-amber-955/10 border border-amber-500/15 rounded-xl flex items-start gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-750 dark:text-amber-500 font-extrabold leading-relaxed text-right">
              إجراء احترازي ومسؤولية حماية العمل: يرجى العلم بأن تنزيل نسخ دورية شاملة وتخزينها بأمان تام خارج السحابة هو خياركم الإستراتيجي الأمثل لضمان تواصل العمل دون عقبات في أي وضع خارجي صعب.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
