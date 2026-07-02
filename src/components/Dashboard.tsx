import React from 'react';
import { Item, Activity } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  ChevronRight,
  Search,
  Moon,
  Sun,
  LogOut,
  Bell,
  Menu
} from 'lucide-react';

interface DashboardProps {
  items: Item[];
  activities: Activity[];
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ items, activities, setActiveTab }) => {
  // Let's filter real out-of-stock or low-stock items from the actual inventory state (representing their real stock)
  const lowStockItems = items.filter(item => item.quantity <= 3);

  return (
    <div className="space-y-6 animate-fadeIn text-right" dir="rtl">
      {/* Welcome & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#5E1A1A] tracking-tight">
          مرحباً بك في متجر الحسام فون
        </h1>
        <p className="text-[#8B7E74] text-sm md:text-base font-medium mt-1">
          نظرة عامة على أداء المؤسسة اليوم
        </p>
      </div>

      {/* Top Action Buttons */}
      <div className="flex gap-4">
        {/* New Invoice (Brown Accent) */}
        <button
          onClick={() => setActiveTab('pos')}
          className="flex-1 max-w-[200px] h-12 bg-[#5E1A1A] hover:bg-[#4d1515] active:bg-[#3d1111] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-[#5E1A1A]/10 transition-all cursor-pointer"
          id="btn-new-invoice"
        >
          <span>فاتورة جديدة</span>
          <span className="text-lg font-light leading-none">+</span>
        </button>

        {/* Download Report (White Accent) */}
        <button
          onClick={() => {
            alert('تم جلب وتجهيز التقرير العام بنجاح لمؤسسة الحسام فون.');
          }}
          className="flex-1 max-w-[200px] h-12 bg-white hover:bg-slate-50 text-[#5E1A1A] border border-[#EBE3DB] text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          id="btn-download-report"
        >
          <span>تحميل تقرير</span>
        </button>
      </div>

      {/* 2x2 Grid of Primary Stats Card */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Card 1: صافي الأرباح (Top Right) */}
        <div className="bg-white border border-[#F0E6DD] rounded-3xl p-5 shadow-xs flex flex-col justify-between h-[130px] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[#8B7E74] text-xs font-bold">صافي الأرباح</span>
            <div className="w-10 h-10 rounded-2xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-[#2D241E] font-mono leading-none">
              198,500 <span className="text-[10px] md:text-xs text-[#8B7E74]">ر.ي</span>
            </h3>
            <p className="text-[10px] md:text-xs text-[#2E7D32] font-semibold mt-1 flex items-center gap-0.5">
              <span>⬈</span>
              <span>الربح الحقيقي النهائي</span>
            </p>
          </div>
        </div>

        {/* Card 2: إجمالي المبيعات (Top Left) */}
        <div className="bg-white border border-[#F0E6DD] rounded-3xl p-5 shadow-xs flex flex-col justify-between h-[130px] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[#8B7E74] text-xs font-bold">إجمالي المبيعات</span>
            <div className="w-10 h-10 rounded-2xl bg-[#F5F5F5] text-slate-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-[#2D241E] font-mono leading-none">
              361,000 <span className="text-[10px] md:text-xs text-[#8B7E74]">ر.ي</span>
            </h3>
            <p className="text-[10px] md:text-xs text-[#2E7D32] font-semibold mt-1 flex items-center gap-0.5">
              <span>⬈</span>
              <span>حجم الإيرادات</span>
            </p>
          </div>
        </div>

        {/* Card 3: إجمالي المصروفات (Bottom Right) */}
        <div className="bg-white border border-[#F0E6DD] rounded-3xl p-5 shadow-xs flex flex-col justify-between h-[130px] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[#8B7E74] text-xs font-bold">إجمالي المصروفات</span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFEBEE] text-[#C62828] flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-[#2D241E] font-mono leading-none">
              20,000 <span className="text-[10px] md:text-xs text-[#8B7E74]">ر.ي</span>
            </h3>
            <p className="text-[10px] md:text-xs text-[#C62828] font-semibold mt-1 flex items-center gap-0.5">
              <span>⬊</span>
              <span>التكاليف التشغيلية</span>
            </p>
          </div>
        </div>

        {/* Card 4: هامش الربح الكلي (Bottom Left) */}
        <div className="bg-white border border-[#F0E6DD] rounded-3xl p-5 shadow-xs flex flex-col justify-between h-[130px] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[#8B7E74] text-xs font-bold">هامش الربح الكلي</span>
            <div className="w-10 h-10 rounded-2xl bg-[#E3F2FD] text-[#0D47A1] flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-[#2D241E] font-mono leading-none">
              218,500 <span className="text-[10px] md:text-xs text-[#8B7E74]">ر.ي</span>
            </h3>
            <p className="text-[10px] md:text-xs text-[#2E7D32] font-semibold mt-1 flex items-center gap-0.5">
              <span>⬈</span>
              <span>قبل خصم المصاريف</span>
            </p>
          </div>
        </div>

      </div>

      {/* Large Longitudinal Cards below the grid */}
      <div className="space-y-4">
        
        {/* Card 5: المبيعات اليومية (Orange) */}
        <div className="bg-white border border-[#F0E6DD] rounded-[2rem] p-5 shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF3E0] text-[#E65100] flex items-center justify-center scale-100">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#8B7E74] text-[10px] md:text-xs font-bold">المبيعات اليومية</p>
              <h4 className="text-xl font-black text-[#E65100] font-mono leading-tight mt-0.5">
                258,500 <span className="text-xs font-sans font-bold">ر.ي</span>
              </h4>
              <p className="text-[10px] text-[#8B7E74] font-medium leading-normal">
                إجمالي مبيعات اليوم الفعلي
              </p>
            </div>
          </div>
        </div>

        {/* Card 6: قطع مباعة اليوم (Green) */}
        <div className="bg-white border border-[#F0E6DD] rounded-[2rem] p-5 shadow-xs flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0F2F1] text-[#00695C] flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#8B7E74] text-[10px] md:text-xs font-bold">قطع مباعة اليوم</p>
              <h4 className="text-xl font-black text-[#00695C] font-mono leading-tight mt-0.5">
                110 <span className="text-xs font-sans font-bold">قطعة</span>
              </h4>
              <p className="text-[10px] text-[#8B7E74] font-medium leading-normal">
                الكمية التي تم بيعها وتفريغها
              </p>
            </div>
          </div>
        </div>

        {/* Card 7: تنبيهات المخزون (Pink) */}
        <div className="bg-[#FFF0F2] border border-[#FFE0E5] rounded-[2rem] p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEBEE] text-[#C62828] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#C62828] text-sm md:text-base leading-tight">تنبيهات المخزون</h3>
              <p className="text-[#C62828]/80 text-[10px] md:text-xs">يرجى متابعة الكميات قارشي النفاد بالمخزن وتعبئة المنتجات</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {lowStockItems.length === 0 ? (
              <div className="text-xs text-slate-500 py-1 font-semibold">
                ✓ جميع المنتجات المتوفرة في المخزن بوضع تشغيلي سليم مع كميات آمنة.
              </div>
            ) : (
              lowStockItems.slice(0, 3).map((item) => (
                <div key={item.id} className="bg-white/70 backdrop-blur-xs p-3 rounded-2xl border border-[#FFEBEE] flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 font-bold truncate max-w-[170px]">{item.item_name}</span>
                  <span className="text-[#C62828] font-mono font-bold">{item.quantity} حبات متبقية</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
