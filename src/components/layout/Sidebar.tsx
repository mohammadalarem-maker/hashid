import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  ChevronRight,
  CreditCard,
  BarChart3,
  ArrowRightLeft,
  Tag,
  DollarSign,
  Wallet,
  History,
  LogOut,
  Mail,
  Wifi,
  Smartphone,
  Ticket
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useTranslation } from '../../lib/translations';
import { useData } from '../../lib/DataContext';
import defaultAppIcon from '../../assets/images/app_icon_1781726496895.jpg';

interface SidebarItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  badge?: number | string;
  onClick?: () => void;
}

const SidebarItem = ({ to, icon: Icon, label, collapsed, badge, onClick }: SidebarItemProps) => {
  const { t, language } = useTranslation();
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
        ${isActive 
          ? `bg-secondary/10 text-primary font-medium ${language === 'ar' ? 'border-l-4' : 'border-r-4'} border-primary` 
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'}
      `}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={`whitespace-nowrap flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}
          >
            {t(label)}
          </motion.span>
        )}
      </AnimatePresence>
      {badge !== undefined && badge !== 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
          typeof badge === 'number' && badge > 0 ? 'bg-red-500 text-white' : 'bg-secondary text-white'
        } ${collapsed ? 'absolute top-1 right-1' : ''}`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
};

export default function Sidebar({ mobileOpen, setMobileOpen, onLogoutClick }: { mobileOpen?: boolean, setMobileOpen?: (open: boolean) => void, onLogoutClick?: () => void }) {
  const { role, user, logout } = useAuth();
  const { t, language } = useTranslation();
  const { items, shopSettings } = useData();
  const [collapsed, setCollapsed] = useState(false);

  const lowStockCount = items.filter(item => (item.stock || 0) <= (item.minStock || 0)).length;
  const shopName = shopSettings?.shopName || 'الحسام فون';
  const logoUrl = shopSettings?.logoUrl || null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen?.(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        animate={{ 
          width: collapsed ? 80 : 260,
          x: mobileOpen ? 0 : undefined
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`
          fixed top-0 bottom-0 ${language === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} z-50 bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 flex flex-col shadow-xl lg:shadow-none
          lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : (language === 'ar' ? 'translate-x-full' : '-translate-x-full') + ' lg:translate-x-0'}
        `}
      >
        {/* Header/Logo */}
        <div className="h-16 border-b border-gray-100 dark:border-slate-800 px-4 flex items-center shrink-0">
          <div className="flex items-center justify-between w-full h-full">
            <div className={`flex items-center gap-3 ${collapsed ? 'mx-auto' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0 shadow-sm overflow-hidden text-primary font-bold">
                <img 
                  src={logoUrl || defaultAppIcon} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.currentTarget.src = defaultAppIcon; }} 
                />
              </div>
              {!collapsed && (
                <motion.div
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className={`flex flex-col ${language === 'ar' ? 'text-right' : 'text-left'}`}
                >
                  <span className="text-[11px] font-black text-primary tracking-tight uppercase line-clamp-1">{shopName}</span>
                  <span className="text-[9px] text-gray-400 font-bold line-clamp-1">
                    {user?.displayName || t('مستخدم النظام')}
                  </span>
                </motion.div>
              )}
            </div>
            
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className={`p-2 rounded-xl transition-all duration-300 hidden lg:block ${collapsed ? 'bg-secondary/5 text-secondary scale-110 mt-2' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400'}`}
            >
              {collapsed ? (
                <ChevronRight className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''}`} />
              ) : (
                <ChevronRight className={`w-4 h-4 ${language === 'ar' ? '' : 'rotate-180'}`} />
              )}
            </button>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden p-2 text-gray-400"
            >
              <ChevronRight className={`w-5 h-5 ${language === 'ar' ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
          <SidebarItem to="/" icon={LayoutDashboard} label="لوحة التحكم" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <div className="py-2">
            {!collapsed && <span className="px-3 text-[10px] font-bold text-secondary uppercase tracking-wider">{t('النظام المالي')}</span>}
          </div>
          <SidebarItem to="/accounting" icon={BookOpen} label="دليل الحسابات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/accounting/expenses" icon={DollarSign} label="إدارة المصروفات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/accounting/debts" icon={Wallet} label="إدارة الديون" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/accounting/journal" icon={ArrowRightLeft} label="إدارة كشوفات النظام" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/inventory" icon={Package} label="المخازن والمشتريات" collapsed={collapsed} badge={lowStockCount} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/inventory/categories" icon={Tag} label="فئات المنتجات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/network-cards" icon={Ticket} label="إدارة ومبيعات كروت الشبكة" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/network-recharge" icon={Smartphone} label="إدارة وتعبئة رصيد الباقات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/sales" icon={ShoppingCart} label="فواتير المبيعات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/customers" icon={Users} label="قاعدة العملاء" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/pos" icon={CreditCard} label="نقطة البيع (POS)" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          
          <div className="py-2">
            {!collapsed && <span className="px-3 text-[10px] font-bold text-secondary uppercase tracking-wider">{t('الإدارة')}</span>}
          </div>
          <SidebarItem to="/reports" icon={BarChart3} label="التقارير" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          <SidebarItem to="/gmail" icon={Mail} label="بريد Gmail" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          {role === 'admin' && (
            <>
              <SidebarItem to="/reports/activity" icon={History} label="سجل العمليات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
              <SidebarItem to="/users" icon={Users} label="المستخدمين" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 space-y-2">

          {role === 'admin' && (
            <SidebarItem to="/settings" icon={Settings} label="الإعدادات" collapsed={collapsed} onClick={() => setMobileOpen?.(false)} />
          )}

          {!collapsed && (
            <div className="px-3 py-2 bg-gradient-to-r from-orange-50/30 to-amber-50/30 dark:from-slate-800/50 dark:to-slate-800/25 border border-amber-150/10 rounded-xl text-[10px] text-gray-400 font-bold flex flex-col items-center justify-center gap-0.5 mt-1 mb-2 text-center select-none">
              <span className="text-gray-500 font-bold">برمجة وتطوير المبرمج</span>
              <span className="text-secondary font-black text-xs">مازن فارع</span>
              <span className="font-mono text-primary font-black">776591639</span>
            </div>
          )}

          <button
            onClick={() => {
              if (onLogoutClick) {
                onLogoutClick();
              } else {
                logout();
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/10 hover:text-red-600 font-bold text-sm cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="whitespace-nowrap pr-2"
                >
                  {t('تسجيل الخروج')}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
