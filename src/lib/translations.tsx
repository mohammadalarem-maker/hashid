import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const translations: Record<string, string> = {
  // Navigation & Group Titles
  'لوحة التحكم': 'Dashboard',
  'الرئيسية': 'Home',
  'النظام المالي': 'Financial System',
  'دليل الحسابات': 'Chart of Accounts',
  'إدارة المصروفات': 'Expenses Management',
  'إدارة الديون': 'Debts Management',
  'إدارة كشوفات النظام': 'System Ledgers Management',
  'دفتر اليومية': 'General Journal',
  'المخازن والمشتريات': 'Inventory & Purchases',
  'فئات المنتجات': 'Product Categories',
  'فواتير المبيعات': 'Sales Invoices',
  'قاعدة العملاء': 'Customer Base',
  'نقطة البيع (POS)': 'Point of Sale (POS)',
  'نقطة البيع': 'POS',
  'المخزون': 'Inventory',
  'المبيعات': 'Sales',
  'الإدارة': 'Administration',
  'التقارير': 'Reports',
  'سجل العمليات': 'Activity Log',
  'المستخدمين': 'Users',
  'الاعدادات': 'Settings',
  'الإعدادات': 'Settings',

  // Top Bar & Header elements
  'بحث سريع...': 'Quick Search...',
  'المظهر/اللون': 'Theme/Color',
  'تسجيل الخروج': 'Log Out',
  'مدير النظام': 'System Admin',
  'محاسب': 'Accountant',
  'مستخدم النظام': 'System User',
  'مستخدم غير معروف': 'Unknown User',

  // Login Page
  'تسجيل الدخول': 'Sign In',
  'البريد الإلكتروني': 'Email Address',
  'كلمة المرور': 'Password',
  'نسيت كلمة المرور؟': 'Forgot Password?',
  'الدخول بواسطة جوجل': 'Sign in with Google',
  'تذكر بيانات تسجيل الدخول على هذا الجهاز': 'Remember login credentials on this device',
  'تفعيل تسجيل الدخول بالبصمة على هذا الجهاز': 'Enable fingerprint login on this device',
  'تطوير: م/ مازن فارع - 2024': 'Developed by: Eng. Mazen Faraa - 2024',
  'تطوير المهندس:': 'Developed by Eng:',
  'مازن فارع': 'Mazen Faraa',
  'نسيت كلمة المرور': 'Forgot Password',
  'أدخل بريدك الإلكتروني أدناه وسنرسل إليك رابطاً لإعادة تعيين كلمة المرور فوراً.': 'Enter your email below and we will send you a password reset link immediately.',
  'إرسال الرابط': 'Send Reset Link',
  'إلغاء الأمر': 'Cancel',
  'مرحباً بك مجدداً في نظام م/ مازن فارع': 'Welcome back to Eng. Mazen Faraa System',
  'أو': 'Or',
  'ر.ي': 'YER',
  'ر.س': 'SAR',
  '$': '$',
  'حسابك معطل': 'Account Suspended',
  'عفواً، تم تعطيل وصولك للنظام من قبل الإدارة. يرجى مراجعة المدير.': 'Sorry, your access to the system was disabled by administration. Please contact the manager.',

  // Common UI words
  'تحديث': 'Update',
  'حفظ': 'Save',
  'إلغاء': 'Cancel',
  'إضافة': 'Add',
  'تعديل': 'Edit',
  'حذف': 'Delete',
  'بحث': 'Search',
  'تصفية': 'Filter',
  'الكل': 'All',
  'تأكيد': 'Confirm',
  'نعم': 'Yes',
  'لا': 'No',
  'تأكيد تسجيل الخروج': 'Confirm Logout',
  'هل أنت متأكد من رغبتك في تسجيل الخروج من النظام؟': 'Are you sure you want to log out of the system?',
  'نعم، خروج': 'Yes, Exit',
  'هل أنت متأكد من رغبتك في تسجيل الخروج وتأمين الكاشير؟': 'Are you sure you want to log out and secure the cashier?',
  'مرحباً،': 'Welcome,',
  'مرحباً بالمدير': 'Welcome, Admin',
  'إدارة وربط الطابعات الحرارية': 'Manage Thermal Printers',
  'لوحة الإشعارات والتنبيهات والمخازن': 'Notifications & Stock Warnings',
  'تبديل وضع الألوان المرئي': 'Toggle Theme Mode',
  'المدير العام للمتجر (Admin)': 'Shop General Manager (Admin)',
  'كاشير المبيعات الحالي (Cashier)': 'Current Sales Cashier (Cashier)',
  'إغلاق': 'Close',

  // Inventory & Quick Stocktake (Camer barcode)
  'جرد المخازن بالكاميرا 📸': 'Camera Stocktake 📸',
  'الجرد السريع والتدقيق الميداني بالكاميرا 📸': 'Quick Camera & Field Stocktake 📸',
  'تحديث كميات مستويات الإمداد وتدقيق المنتجات لحظياً في Firestore': 'Update stock levels and audit products in real-time in Firestore',
  'اختر وضع معالجة الجرد:': 'Choose Stocktake Mode:',
  'تراكمي (+1) بالكامل بمسحة واحدة أو مراجعة يدوية وتخصيص التفاصيل والأرقام.': 'Cumulative (+1) scan, or manual review to customize details and numbers.',
  'مراجعة وتعديل كميات ✏️': 'Review & Edit Quantities ✏️',
  'مسح تراكمي فوري (+1) ⚡': 'Cumulative Scan (+1) ⚡',
  'اضغط لتشغيل الكاميرا ومسح الباركود الجديد 📸': 'Tap to Start Camera & Scan Barcode 📸',
  'تتكامل مستويات المخزون الجديدة وتتحدث تلقائياً بجميع الشاشات وصناديق الحساب.': 'New stock levels integrate automatically across all screens and accounts.',
  'الرمز الأخير المسحوب:': 'Last Scanned Barcode:',
  'وجه الهاتف نحو باركود السلعة ليتم جلبه لحظياً': 'Aim the camera at the product barcode to fetch it instantly',
  'الكمية الحالية بالمخزون': 'Current Stock Quantity',
  'سعر البيع المعزز:': 'Sale Price:',
  'جرد وتخصيص مستويات الكمية الفعلية:': 'Audit and Specify Actual Quantities:',
  'تم عدّها في الرفوف': 'Counted on shelves',
  'تخطي': 'Skip',
  'تحديث وتثبيت الجرد الحالي': 'Apply & Confirm Current Stocktake',
  'تم إدراج كمية (+1) للتعديل التراكمي في الفايرستور تلقائياً بنجاح!': 'Successfully added (+1) cumulative adjustment to Firestore!',
  'الباركود المسحوب غير مسجل!': 'Scanned barcode is not registered!',
  'لا توجد سلعة مسجلة بهذا الباركود في مخازنك حالياً.': 'No item is registered with this barcode in your inventory.',
  'إضافة كمنتج جديد بمخازنك': 'Add as New Product in Inventory',
  'اربط هذا الباركود بمنتج مسجل مسبقاً في مخازنك لا يمتلك كود تفريغي.': 'Link this barcode to an existing item without barcode.',
  'ابحث بالاسم لتحديده وربط الكود...': 'Search by name to link barcode...',
  'سجل المجرودات والمستويات المحدثة في هذه الجلسة': 'Stocktake logs updated in this session',
  'لم يتم جرد أي مواد خلال جلسة العمل الحالية بعد.': 'No items have been audited in this session yet.',
  'إغلاق نافذة الجرد': 'Close Stocktake Window',

  // Settings Page English Header
  'إعدادات النظام': 'System Settings',
  'تحكم بخصائص نظام': 'Control the features of system',
  'وتخصيص المظهر': 'and customize themes',
  'الإعدادات العامة لمحل الجوالات': 'General Settings for Mobile Shop',
  'اسم المحل / العلامة التجارية': 'Shop Name / Brand',
  'رقم الهاتف كاشير': 'Cashier Phone Number',
  'البريد الإلكتروني للمحل': 'Shop Email Address',
  'عنوان المحل / الموقع': 'Shop Address / Location',
  'قائمة الإعدادات الفرعية': 'Sub-settings Menu',
  'المعلومات العامة': 'General Information',
  'الشعار السحابي': 'Cloud Logo',
  'الألوان والمظهر': 'Colors & Theme',
  'اللغة والعملة والمنطقة': 'Language, Currency & Region',
  'النسخ الاحتياطي': 'Backup & Restore',
  'تطوير وتصميم وبرمجة': 'Developed and Designed by',
  'لغة واجهة النظام': 'System Interface Language',
  'العربية': 'Arabic',
  'الإنجليزية': 'English',
  'الإعدادات والخيارات العامة': 'General Settings & Preferences',
  'تحرير اسم المتجر، شعار المؤسسة، العملة، وعناوين تذاكر طباعة إيصالات الكاشير': 'Edit shop name, company logo, currency, and footer titles for receipt printing',
  'لوجو وشعار المؤسسة': 'Logo & Brand Identity',
  'سيتم دمج وتضمين هذا الشعار تلقائيًا أعلى فواتير الـ PDF المطبوعة والمشتركة بالبريد.': 'This logo will be integrated automatically at the top of printed and shared PDFs.',
  'اختر صورة الشعار 🖼️': 'Choose Logo Image 🖼️',
  'إلغاء واستعادة الافتراضي': 'Reset to Default',
  'اسم المتجر / المؤسسة': 'Store / Shop Name',
  'أرقام التواصل والتلفون': 'Contact Phone Numbers',
  'العنوان الجغرافي للمحل': 'Geographical Address',
  'اختصار العملة الافتراضية': 'Currency Abbreviation',
  'الوضع والمظهر الافتراضي': 'Theme Mode',
  'المظهر الفاتح الدافئ': 'Warm Light Theme',
  'المظهر الداكن الفخم': 'Luxury Dark Theme',
  'ملاحظات تذيلية وشروط الفاتورة (ملاحظات الكاشير)': 'Tax/Receipt Notes & Conditions',
  'أية بنود أو شروط تظهر تذيلية في إيصال وقسيمة البيع...': 'Any terms or conditions appearing on the printed invoice...',
  'نظام تعدد العملات وأسعار الصرف': 'Multi-Currency System',
  'تفعيل الدعم المالي لبيع ومتابعة الأرباح بالعملات الأجنبية كالدولار والسعودي': 'Activate dual/multi-currency pricing (USD, SAR) and direct conversion tracking',
  'إيقاف': 'Inactive',
  'تفعيل النشاط': 'Active',
  'اسم/رمز العملة': 'Currency Code',
  'شعار العملة': 'Symbol',
  'سعر الصرف (للعملة الواحدة)': 'Exchange Rate (Per 1 Unit)',
  'الحالة والإجراءات': 'Status & Actions',
  'العملة الأساسية': 'Base Currency',
  'إضافة عملة أجنبية جديدة:': 'Add New Foreign Currency:',
  'إدراج العملة في الجدول 🎯': 'Add Currency To Table 🎯',
  'حفظ كافة التغييرات والتفضيلات 💾': 'Save All Settings & Preferences 💾',
  'تصدير وحفظ النسخ الاحتياطية لقواعد البيانات': 'Backup Databases & Export Tables',
  'تنزيل جداول العمل تلافياً لأي طارئ وضمان تخزينها خارج النظام': 'Download system data tables to external storage for safekeeping',
  'تصدير نسخة احتياطية شاملة (JSON) 📥': 'Export Full Database Backup (JSON) 📥',
  'تصدير وتنزيل جداول مخصصة للعمل (JSON / CSV):': 'Download Individual System Tables (JSON/CSV):',
  'المنتجات والمخزون المالي': 'Products & Financial Inventory',
  'فئات وأقسام الأصناف': 'Product Sections & Categories',
  'الفواتير والمبيعات اليومية': 'Daily Invoices & Cumulative Sales',
  'العملاء وحسابات المستفيدين': 'Customers Accounts & Database',
  'الديون الموقوفة والمديونيات': 'Ledger Debts & Liabilities',
  'المصروفات والمشتريات التشغيلية': 'Operating Expenses & Purchases',
  'دليل الحسابات والأستاذ المالي': 'Chart of Accounts & Ledgers',
  'القيود اليومية العامة واليومية المساعدة': 'Double Journal Entries & Ledger Records',
  'سجلات عمليات وأنشطة الموظفين': 'Employee Logs & Security Audits',
  'إدارة المستخدمين وصلاحيات الحسابات': 'Users Management & System Roles',


  'عملة النظام الافتراضية': 'Default System Currency',
  'ريال يمني (YER)': 'Yemeni Rial (YER)',
  'ريال سعودي (SAR)': 'Saudi Rial (SAR)',
  'دولار أمريكي (USD)': 'US Dollar (USD)',
  'درهم إماراتي (AED)': 'UAE Dirham (AED)',
  'جنيه مصري (EGP)': 'Egyptian Pound (EGP)',
  'تذييل فاتورة المبيعات الافتراضي': 'Default Sales Bill Footer',
  'سيظهر هذا النص في أسفل كل فاتورة مبيعات يتم طباعتها.': 'This text will appear at the bottom of every printed sales invoice.',
  'حفظ الإعدادات': 'Save Settings',
  'جاري الحفظ...': 'Saving...',

  // App Layout labels
  'قائمة خيارات الألوان المتاحة': 'List of available system coloring themes:',
  'بني كلاسيك': 'Classic Brown',
  'بني مع أبيض': 'Brown & White',
  'رمادي كوني': 'Cosmic Gray',
  'كحلي احترافي': 'Navy Professional',
  'بنفسجي ملكي': 'Royal Violet',
  'أخضر زيتي': 'Olive Green',
  'وردي عصري': 'Modern Pink',
  'أزرق سماوي': 'Sky Blue',
  'ذهبي فاخر': 'Luxury Gold',
  'رفع شعار': 'Upload Logo',
  'تحديث بيانات المحل والمنظومة': 'Update shop and system settings databases.',

  // Additional settings text
  'طريقة العرض وتناسق الألوان لراحة العين وتحسين تجربة المستخدم.': 'Visual layout and synchronized colors for eye comfort and improved UX.',
  'البرمجيات السحابية': 'Cloud Backups',
  'النسخة الاحتياقية السحابية واليدوية': 'Cloud & Manual Backups',
  'تحميل نسخة احتياطية': 'Download Backup',
  'استعادة من نسخة احتياطية': 'Restore from Backup',
  'تمكين النسخ الاحتياطي التلقائي': 'Enable Automatic Cloud Backup',
  'رفع شعار المحل المخصص للتقارير والفواتير وسندات الصرف والقبض.': 'Upload customized shop logo for reports, invoices, and cash bills.',

  // Interactive ledger & periodic notebook translations
  'الدفتر الشهري والسنوي': 'Monthly & Annual Ledger Books',
  'الدفتر الشهري': 'Monthly Ledger Book',
  'الدفتر السنوي': 'Annual Ledger Book',
  'القيود اليومية': 'Daily Journal Entries',
  'عرض التفاصيل': 'Show Details',
  'إجمالي المبيعات': 'Total Sales',
  'إجمالي المصروفات': 'Total Expenses',
  'الصافي / الفارق': 'Net Profit / Margin',
  'مدين': 'Debit',
  'دائن': 'Credit',
  'قيد يدوي جديد': 'New Manual Entry',
  'إضافة قيد محاسبي': 'Add Journal Entry',
  'البيان / الوصف': 'Statement / Description',
  'المرجع / ملاحظات': 'Reference / Notes',
  'التاريخ': 'Date',
  'الرقم': 'Number',
  'التفاصيل': 'Details',
  'تصفية حسب النوع': 'Filter by Type',
  'تنبيه': 'Warning',
  'تم إدخال القيد بنجاح!': 'Journal Entry added successfully!',
  'خطأ في الحفظ': 'Save Error',
  'إجمالي': 'Total',
  'فشل الاتصال': 'Connection Failed',
  'بحث في القيود...': 'Search entries...',
  'توازن الحساب': 'Account Balance',
  'لا توجد بيانات لهذا العام': 'No data available for this year',
  'العمليات المحاسبية': 'Accounting Transactions',
  'استعراض تفاصيل الشهر': 'Browse Month Details',
  'استعراض تفاصيل السنة': 'Browse Year Details',
  'دفتر اليومية الإلكتروني': 'Digital Daily Journal'
};

interface TranslationContextType {
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  t: (text: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    // Listen to firestore settings reactively
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.language && (data.language === 'ar' || data.language === 'en')) {
          setLanguageState(data.language);
          document.documentElement.lang = data.language;
          document.documentElement.dir = data.language === 'ar' ? 'rtl' : 'ltr';
        }
      }
    }, (err) => {
      console.error("Translation onSnapshot error:", err);
    });

    return () => unsub();
  }, []);

  const setLanguage = (lang: 'ar' | 'en') => {
    setLanguageState(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  const t = (text: string): string => {
    if (language === 'ar') return text;
    // For English
    const trimmed = text.trim();
    return translations[trimmed] || translations[text] || text;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    // Return a safe fallback hook if no Provider is present
    return {
      language: 'ar' as const,
      setLanguage: () => {},
      t: (text: string) => text
    };
  }
  return context;
}
