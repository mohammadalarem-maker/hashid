import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Settings,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTranslation } from '../../lib/translations';

export default function BottomNav() {
  const { role } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center justify-around px-2 py-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] safe-bottom">
      <NavLink 
        to="/" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400'}`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[9px] font-bold">{t('الرئيسية')}</span>
      </NavLink>
      <NavLink 
        to="/pos" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400'}`}
      >
        <CreditCard className="w-5 h-5" />
        <span className="text-[9px] font-bold">{t('نقطة البيع')}</span>
      </NavLink>
      <NavLink 
        to="/inventory" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400'}`}
      >
        <Package className="w-5 h-5" />
        <span className="text-[9px] font-bold">{t('المخزون')}</span>
      </NavLink>
      <NavLink 
        to="/sales" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400'}`}
      >
        <ShoppingCart className="w-5 h-5" />
        <span className="text-[9px] font-bold">{t('المبيعات')}</span>
      </NavLink>
      {role === 'admin' && (
        <NavLink 
          to="/settings" 
          className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px] font-bold">{t('الاعدادات')}</span>
        </NavLink>
      )}
    </nav>
  );
}
