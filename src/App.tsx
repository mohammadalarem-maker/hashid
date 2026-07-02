import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu, Printer, LogOut, Bell, Shield, ChevronDown } from 'lucide-react';
import { useAuth } from './lib/AuthContext';
import { Login } from './components/Login';
import ThemeProvider, { useTheme } from './components/ThemeProvider';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import Dashboard from './pages/Dashboard';
import AccountingPage from './pages/Accounting';
import Expenses from './pages/Expenses';
import Debts from './pages/Debts';
import JournalPage from './pages/Journal';
import Inventory from './pages/Inventory';
import CategoriesPage from './pages/Categories';
import SalesHistory from './pages/Sales';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Reports from './pages/Reports';
import Gmail from './pages/Gmail';
import ActivityLog from './pages/ActivityLog';
import UsersPage from './pages/Users';
import Settings from './pages/Settings';
import NetworkCards from './pages/NetworkCards';
import NetworkRecharge from './pages/NetworkRecharge';
import NotificationCenter from './components/ui/NotificationCenter';
import { BluetoothPrinterModal } from './components/ui/BluetoothPrinterModal';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { motion, AnimatePresence } from 'motion/react';
import defaultAppIcon from './assets/images/app_icon_1781726496895.jpg';
import { useConfirm } from './lib/ConfirmContext';
import { useTranslation } from './lib/translations';
import { PullToRefresh } from './components/ui/PullToRefresh';

function AppContent() {
  const { user, logout, role } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPrinterOpen, setIsPrinterOpen] = useState(false);
  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState(false);
  const { confirm } = useConfirm();
  const { t, language } = useTranslation();
  const location = useLocation();
  const [isPageLoading, setIsPageLoading] = useState(false);

  useEffect(() => {
    setIsPageLoading(true);
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 60); // Incredibly fast visual transition, making page loads feel instant!
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // فحص تلقائي للتحصيل وجدول الديون المستحقة اليوم عند الدخول للنظام
  useEffect(() => {
    if (user && role === 'admin') {
      const runDebtsCheck = setTimeout(() => {
        import('./lib/notifications').then(({ checkAndNotifyDueDebts }) => {
          checkAndNotifyDueDebts().catch(err => console.error("Error running due debts checker: ", err));
        });
      }, 3000);
      return () => clearTimeout(runDebtsCheck);
    }
  }, [user, role]);

  // Logout callback confirmation prompts
  const confirmSignOut = async () => {
    const doubleCheck = await confirm({
      title: t('تأكيد تسجيل الخروج'),
      message: t('هل أنت متأكد من رغبتك في تسجيل الخروج وتأمين الكاشير؟'),
      isDanger: true,
      confirmText: t('تسجيل الخروج'),
      cancelText: t('إلغاء')
    });
    if (doubleCheck) {
      logout();
    }
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen bg-background text-text transition-colors duration-200" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Desktop Persistent Sidebar Layout */}
      <Sidebar 
        mobileOpen={mobileMenuOpen} 
        setMobileOpen={setMobileMenuOpen} 
        onLogoutClick={confirmSignOut} 
      />

      {/* Main viewport Container (Accounting for right aligned sidebar width: ml-0 lg:mr-64) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${language === 'ar' ? 'lg:pr-[260px]' : 'lg:pl-[260px]'} pb-24 lg:pb-0`} id="main-viewport-body">
         <PullToRefresh>
         
         {/* Sleek Top Header Navigation bar representing ultimate precision */}
         <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40 select-none">
            
            {/* Right side: Mobile Toggle Button + Greeting info */}
            <div className="flex items-center gap-3">
               <button
                 onClick={() => setMobileMenuOpen(true)}
                 className="lg:hidden p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 border-none cursor-pointer"
               >
                  <Menu className="w-5 h-5" />
               </button>

               <div className="hidden sm:block">
                  <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-white leading-tight">
                     {t('مرحباً،')} {user?.displayName || t('مستخدم النظام')}
                  </h3>
                  <span className="text-[10px] text-[#8B5E3C] font-extrabold flex items-center gap-1 mt-0.5">
                     <Shield className="w-3 h-3 text-[10px]" />
                     {role === 'admin' ? t('المدير العام للمتجر (Admin)') : t('كاشير المبيعات الحالي (Cashier)')}
                  </span>
               </div>
            </div>

            {/* Left side actions indicators: Theme toggle, notifications, printers pairing */}
            <div className="flex items-center gap-1.5 md:gap-3">
               
               {/* Pair printer thermal ESC/POS mini button representation */}
               <button
                 onClick={() => setIsPrinterOpen(true)}
                 className="w-10 h-10 rounded-xl bg-secondary/5 hover:bg-secondary/10 text-secondary flex items-center justify-center transition-all cursor-pointer border-none"
                 title={t("إدارة وربط الطابعات الحرارية")}
                 id="pos-thermal-printer-trigger"
               >
                  <Printer className="w-4.5 h-4.5" />
               </button>

               {/* Notifications bell dropdown button trigger */}
               <button
                 onClick={() => setIsAlertCenterOpen(!isAlertCenterOpen)}
                 className="w-10 h-10 rounded-xl bg-secondary/5 hover:bg-secondary/10 text-secondary flex items-center justify-center transition-all relative cursor-pointer border-none"
                 title={t("لوحة الإشعارات والتنبيهات والمخازن")}
                 id="notification-bell-main-trigger"
               >
                  <Bell className="w-4.5 h-4.5" />
                  <span className="absolute top-2 left-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />
               </button>

               {/* Theme Toggler Mode selector */}
               <button
                 onClick={toggleTheme}
                 className="w-10 h-10 rounded-xl bg-secondary/5 hover:bg-secondary/10 text-secondary flex items-center justify-center transition-all cursor-pointer border-none font-bold"
                 title={t("تبديل وضع الألوان المرئي")}
               >
                  {isDarkMode ? '🌞' : '🌙'}
               </button>

               <div className="h-6 w-px bg-gray-150 dark:bg-slate-700 hidden sm:block" />

               {/* Lock Cashier LogOut trigger button */}
               <button
                 onClick={confirmSignOut}
                 className="w-10 h-10 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 flex items-center justify-center transition-all cursor-pointer border-none"
                 title={t("تسجيل الخروج")}
               >
                  <LogOut className="w-4.5 h-4.5" />
               </button>
            </div>

         </header>

         {/* Floating Alert Center and Low-Stock notification listings inside Drawer */}
         <AnimatePresence>
            {isAlertCenterOpen && (
               <div className="absolute top-16 left-6 z-50">
                  <div className="fixed inset-0 bg-transparent" onClick={() => setIsAlertCenterOpen(false)} />
                  <div className="relative">
                     <NotificationCenter />
                  </div>
               </div>
            )}
         </AnimatePresence>

         {/* Central Content routes container with smooth margins */}
         <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-24 md:pb-6 lg:pb-8" id="pos-central-main-routes">
            {isPageLoading ? (
               <PageSkeleton pathname={location.pathname} />
            ) : (
               <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/accounting" element={<AccountingPage />} />
                  <Route path="/accounting/expenses" element={<Expenses />} />
                  <Route path="/accounting/debts" element={<Debts />} />
                  <Route path="/accounting/journal" element={<JournalPage />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/inventory/categories" element={<CategoriesPage />} />
                  <Route path="/network-cards" element={<NetworkCards />} />
                  <Route path="/network-recharge" element={<NetworkRecharge />} />
                  <Route path="/sales" element={<SalesHistory />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/gmail" element={<Gmail />} />
                  
                  {/* Role-based guard routing representation on user control activity logs */}
                  {role === 'admin' ? (
                     <>
                        <Route path="/reports/activity" element={<ActivityLog />} />
                        <Route path="/users" element={<UsersPage />} />
                     </>
                  ) : (
                     <>
                        <Route path="/reports/activity" element={<Navigate to="/" replace />} />
                        <Route path="/users" element={<Navigate to="/" replace />} />
                     </>
                  )}

                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
               </Routes>
            )}
         </main>

         {/* Persistent Bottom Sticky Layout Navigation on small devices (Renders only in mobile breakpoint) */}


         </PullToRefresh>

         {/* Persistent Bottom Sticky Layout Navigation on small devices (Renders only in mobile breakpoint) */}
         <BottomNav />
      </div>

      {/* Embedded Printers pairing drawer bluetooth model modal representation */}
      <AnimatePresence>
         {isPrinterOpen && (
            <BluetoothPrinterModal isOpen={isPrinterOpen} onClose={() => setIsPrinterOpen(false)} />
         )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
     return (
       <div className="min-h-screen bg-[#0D0B0A] flex flex-col justify-center items-center p-6 text-center select-none overflow-hidden relative" dir="rtl">
          {/* Subtle warm ambient background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
          
          <div className="flex flex-col items-center gap-6 relative z-10">
             {/* Logo Container with Glow & Pulsing scale/opacity */}
             <motion.div 
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    "0 0 20px 2px rgba(226, 168, 92, 0.15)",
                    "0 0 35px 8px rgba(226, 168, 92, 0.35)",
                    "0 0 20px 2px rgba(226, 168, 92, 0.15)"
                  ]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 rounded-[1.75rem] bg-[#180F0A] border-2 border-[#E2A85C]/40 flex items-center justify-center p-0.5 shadow-2xl overflow-hidden"
             >
                <img 
                   src={defaultAppIcon} 
                   alt="الحسام فون" 
                   className="w-full h-full object-cover rounded-[1.6rem]" 
                   referrerPolicy="no-referrer"
                />
             </motion.div>
             
             {/* Label / Subtext with high-end typography and pulsing/fading color flow */}
             <div className="flex flex-col items-center gap-2 mt-2">
                <motion.h2 
                   animate={{
                     opacity: [0.85, 1, 0.85]
                   }}
                   transition={{
                     duration: 2.2,
                     repeat: Infinity,
                     ease: "easeInOut"
                   }}
                   className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 tracking-wide font-sans drop-shadow-[0_2px_10px_rgba(226,168,92,0.1)]"
                >
                   نظام الحسام فون الذكي
                </motion.h2>
                <p className="text-[10px] tracking-widest text-[#B3803E]/70 font-mono">
                   SECURE DATABASE CONNECTION
                </p>
                
                {/* Text showing the real-time activity */}
                <motion.p 
                   animate={{
                     opacity: [0.6, 0.95, 0.6]
                   }}
                   transition={{
                     duration: 2.2,
                     repeat: Infinity,
                     ease: "easeInOut",
                     delay: 0.3
                   }}
                   className="text-[11px] font-bold text-amber-500/80 mt-1"
                >
                   جاري قراءة وتشفير قواعد الحسام فون...
                </motion.p>
             </div>
             
             {/* Bottom miniature progress-indicator */}
             <div className="w-32 h-1 bg-[#1A120B] rounded-full overflow-hidden mt-2 border border-amber-500/10">
                <motion.div 
                   initial={{ x: "-100%" }}
                   animate={{ x: "100%" }}
                   transition={{
                     duration: 1.8,
                     repeat: Infinity,
                     ease: "easeInOut"
                   }}
                   className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#E2A85C] to-transparent rounded-full"
                />
             </div>
          </div>
       </div>
     );
  }

  return (
    <ThemeProvider>
       <AppContent />
    </ThemeProvider>
  );
}
