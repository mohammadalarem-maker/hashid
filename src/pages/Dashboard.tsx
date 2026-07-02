import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  ArrowUpRight,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Clock,
  Minus,
  Coins,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { exportToPDF } from '../lib/pdfExport';
const reportsIcon = 'https://i.imgur.com/gK9Jd74.png';
const inventoryIcon = 'https://i.imgur.com/gK9Jd74.png';



interface StatCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ElementType;
  color: string;
}

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: StatCardProps) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-surface p-4 md:p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{title}</p>
        <h3 className="text-sm md:text-2xl font-bold text-foreground truncate">{value}</h3>
        <div className="flex items-center mt-1 md:mt-2">
          <span className={`text-[9px] md:text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" />}
            {change}
          </span>
        </div>
      </div>
      <div className={`p-2 md:p-3 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-4 h-4 md:w-6 md:h-6" />
      </div>
    </div>
  </motion.div>
);

const DashboardSkeleton = () => (
  <div className="space-y-6 pb-20 md:pb-6 animate-pulse text-right" dir="rtl">
    {/* Page Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-6 w-56 bg-gray-200 dark:bg-slate-800 rounded-md"></div>
        <div className="h-4 w-40 bg-gray-100 dark:bg-slate-800 rounded-md"></div>
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-28 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="h-10 w-28 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
      </div>
    </div>

    {/* Stat Cards Grid Skeleton */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface p-4 md:p-6 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-16 bg-gray-200 dark:bg-slate-800 rounded"></div>
              <div className="h-6 w-24 bg-gray-300 dark:bg-slate-700 rounded-md"></div>
              <div className="h-3 w-12 bg-gray-100 dark:bg-slate-800 rounded"></div>
            </div>
            <div className="w-10 h-10 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>

    {/* Financial Table Skeleton */}
    <div className="bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-6 space-y-4">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-800 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-150 dark:border-slate-800">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-800 rounded"></div>
            <div className="h-3 w-32 bg-gray-150 dark:bg-slate-800 rounded"></div>
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-4 rounded-xl shadow-xl text-right max-w-[280px]" dir="rtl">
        <p className="text-xs font-black text-slate-900 dark:text-slate-100 mb-2 border-b border-gray-100 dark:border-slate-800/80 pb-1.5 font-sans">
          {data.dayName} ، {data.fullDate}
        </p>
        <div className="space-y-1.5 text-xs font-semibold font-sans">
          <div className="flex justify-between items-center gap-8">
            <span className="text-gray-500 dark:text-gray-400">💰 إجمالي المبيعات:</span>
            <span className="font-extrabold text-[#8B5E3C]">
              {Number(data['المبيعات']).toLocaleString()} {currency}
            </span>
          </div>
          <div className="flex justify-between items-center gap-8">
            <span className="text-gray-500 dark:text-gray-400">📈 الأرباح الصافية:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {Number(data['الأرباح']).toLocaleString()} {currency}
            </span>
          </div>
          <div className="flex justify-between items-center gap-8">
            <span className="text-gray-500 dark:text-gray-400">📄 فواتير الكاشير:</span>
            <span className="font-extrabold text-blue-600 dark:text-blue-400">
              {data['الفواتير']} فواتير
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};



export default function Dashboard() {
  const navigate = useNavigate();

  const [shopSettings, setShopSettings] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<number>(7);
  const [chartMetric, setChartMetric] = useState<'sales' | 'profit' | 'invoices'>('sales');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let settingsDone = false;
    let itemsDone = false;
    let expensesDone = false;
    let invoicesDone = false;

    const checkLoading = () => {
      if (settingsDone && itemsDone && expensesDone && invoicesDone) {
        setIsLoading(false);
      }
    };

    // 1. Settings Snapshot
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setShopSettings(snap.data());
      }
      settingsDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      settingsDone = true;
      checkLoading();
    });

    // 2. Items Snapshot
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const itemsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(itemsData);
      itemsDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      itemsDone = true;
      checkLoading();
    });

    // 3. Expenses Snapshot
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      const expensesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(expensesData);
      expensesDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      expensesDone = true;
      checkLoading();
    });

    // 4. Invoices Snapshot
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc'), limit(1500)), (snap) => {
      const invoicesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInvoices(invoicesData);
      invoicesDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      invoicesDone = true;
      checkLoading();
    });

    return () => {
      unsubSettings();
      unsubItems();
      unsubExpenses();
      unsubInvoices();
    };
  }, []);

  // Derived stats
  const convertToYer = (value: number, curr?: string) => {
    return Number(value) || 0;
  };

  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  
  const grossProfit = invoices.reduce((sum, inv) => {
    const invCogs = (inv.items || []).reduce((csum: number, item: any) => {
      return csum + ((item.purchasePrice || 0) * (item.qty || 0));
    }, 0);
    const invRevenue = inv.subtotal || inv.total || 0;
    const invProfit = invRevenue - invCogs;
    return sum + invProfit;
  }, 0);

  const totalExpensesSum = expenses.reduce((sum, d) => sum + (d.amount || 0), 0);
  const netProfit = grossProfit - totalExpensesSum;

  const lowStock = items.filter((i: any) => (i.stock || 0) <= (i.minStock || 5));

  const stats = {
    totalSales,
    totalExpenses: totalExpensesSum,
    grossProfit,
    netProfit,
    itemCount: items.length,
    invoiceCount: invoices.length,
    lowStock: lowStock.slice(0, 5)
  };

  const totalInventoryValue = items.reduce((sum: number, item: any) => {
    const purchasePrice = Number(item.purchasePrice) || Number(item.price) * 0.70 || 0;
    const stock = Number(item.stock) || 0;
    return sum + (purchasePrice * stock);
  }, 0);

  const lastInvoices = invoices.slice(0, 5);

  const downloadReport = async () => {
    await exportToPDF('dashboard-content', `dashboard_report_${Date.now()}`);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Calculate Generation 2 Smart Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(todayStr));
  const dailySales = todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const todayPiecesSold = todayInvoices.reduce((sum, inv) => {
    return sum + (inv.items || []).reduce((isum: number, item: any) => isum + (item.qty || 0), 0);
  }, 0);
  const lowStockCount = items.filter((item: any) => (item.stock || 0) <= (item.minStock || 5)).length;

  // Calculate monthly total sales
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const monthInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(currentMonthStr));
  const monthlySalesAmount = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  const getInteractiveChartData = (daysCount: number) => {
    const data = [];
    const daysWeekAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayName = daysWeekAr[d.getDay()];
      
      const dayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(dateStr));
      const daySales = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const invoicesCount = dayInvoices.length;
      const dayProfit = dayInvoices.reduce((sum, inv) => {
        const invCogs = (inv.items || []).reduce((csum: number, item: any) => {
          return csum + ((item.purchasePrice || 0) * (item.qty || 0));
        }, 0);
        const invRevenue = inv.subtotal || inv.total || 0;
        const invProfit = invRevenue - invCogs;
        return sum + invProfit;
      }, 0);

      data.push({
        name: daysCount <= 7 ? dayName : `${month}/${day}`,
        fullDate: dateStr,
        dayName,
        'المبيعات': daySales,
        'الأرباح': dayProfit,
        'الفواتير': invoicesCount,
      });
    }
    return data;
  };

  const chartData = getInteractiveChartData(chartPeriod);

  let metricColor = '#8B5E3C';
  let metricLabel = 'المبيعات';
  let metricUnit = shopSettings?.currency || 'ر.ي';

  if (chartMetric === 'profit') {
    metricColor = '#059669';
    metricLabel = 'الأرباح';
  } else if (chartMetric === 'invoices') {
    metricColor = '#2563EB';
    metricLabel = 'الفواتير';
    metricUnit = 'فاتورة';
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6 text-right" id="dashboard-content" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary">مرحباً بك في {shopSettings?.shopName || 'الحسام فون'}</h1>
          <p className="text-xs md:text-sm text-secondary mt-1">نظرة عامة على أداء المؤسسة اليوم</p>
        </div>
        <div className="flex gap-2 md:gap-3">
           <button 
            onClick={downloadReport}
            className="flex-1 sm:flex-none bg-surface border border-gray-100 dark:border-slate-800 text-xs md:text-sm text-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
           >
             تحميل تقرير
           </button>
           <button onClick={() => navigate('/pos')} className="flex-1 sm:flex-none btn-primary text-xs md:text-sm py-2 px-4 whitespace-nowrap cursor-pointer">
             فاتورة جديدة +
           </button>
        </div>
      </div>

      {stats.lowStock.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-center sm:text-right">
             <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 text-red-600 rounded-full flex items-center justify-center animate-pulse shrink-0">
                <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
                <h4 className="text-sm font-black text-red-800 dark:text-red-400">تنبيه: مخزون منخفض حرج!</h4>
                <p className="text-[10px] md:text-xs text-red-600 font-bold">يوجد {stats.lowStock.length} أصناف وصلت أو تجاوزت الحد الأدنى.</p>
             </div>
          </div>
          <button 
            onClick={() => navigate('/inventory')}
            className="w-full sm:w-auto bg-red-600 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none cursor-pointer border-none"
          >
            عرض الأصناف المنخفضة
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          title="صافي الأرباح" 
          value={`${(stats.netProfit || 0).toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="الربح الحقيقي النهائي" 
          isPositive={stats.netProfit >= 0} 
          icon={TrendingUp}
          color="bg-green-100 dark:bg-green-950/40 text-green-700 shadow-sm"
        />
        <StatCard 
          title="إجمالي المبيعات" 
          value={`${(stats.totalSales || 0).toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="حجم الإيرادات" 
          isPositive={true} 
          icon={DollarSign}
          color="bg-primary/5 text-primary"
        />
        <StatCard 
          title="إجمالي المصروفات" 
          value={`${(stats.totalExpenses || 0).toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="التكاليف التشغيلية" 
          isPositive={false} 
          icon={TrendingDown}
          color="bg-red-50 dark:bg-red-950/30 text-red-600"
        />
        <StatCard 
          title="هامش الربح الكلي" 
          value={`${(stats.grossProfit || 0).toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="قبل خصم المصاريف" 
          isPositive={stats.grossProfit >= 0} 
          icon={ArrowUpRight}
          color="bg-blue-50 dark:bg-blue-950/30 text-blue-600"
        />
      </div>

      {/* 📦 بطاقة قيمة المخزون بالريال اليمني */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in text-right" dir="rtl">
        <div>
          <h3 className="text-sm font-black text-primary font-sans flex items-center gap-2 justify-start">
            <Package className="w-5 h-5 text-secondary" /> القيمة الاستثمارية الحالية للمخزون
          </h3>
          <p className="text-[10px] text-gray-550 font-bold font-sans mt-1">القيمة المحسوبة بناءً على سعر شراء جميع البضائع المتوفرة حالياً في الرفوف</p>
        </div>
        <div className="text-left shrink-0">
          <span className="text-xl md:text-2xl font-black text-primary font-sans">{totalInventoryValue.toLocaleString()}</span>
          <span className="text-xs font-black text-gray-550 mr-1.5">{shopSettings?.currency || 'ر.ي'}</span>
        </div>
      </div>

      {/* Generation 2 Smart Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Sales Widget */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 dark:from-amber-950/20 dark:to-amber-950/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between shadow-xs"
        >
          <div className="min-w-0 text-right">
             <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">المبيعات اليومية</span>
             <h4 className="text-lg md:text-xl font-extrabold text-amber-950 dark:text-amber-100 truncate">{(dailySales || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}</h4>
             <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-medium">إجمالي مبيعات اليوم الفعلي</p>
          </div>
          <div className="w-10 h-10 bg-amber-500/25 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0 ml-2">
             <ShoppingCart className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Today's Pieces Sold Widget */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-950/20 dark:to-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between shadow-xs"
        >
          <div className="min-w-0 text-right">
             <span className="text-[10px] font-bold text-emerald-700 dark:text-amber-400 uppercase tracking-wider block mb-1">قطع مباعة اليوم</span>
             <h4 className="text-lg md:text-xl font-extrabold text-emerald-950 dark:text-emerald-100 truncate">{(todayPiecesSold || 0).toLocaleString()} قطعة</h4>
             <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">الكمية التي تم بيعها وتفريغها</p>
          </div>
          <div className="w-10 h-10 bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0 ml-2">
             <Package className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Stock Alerts Widget */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 dark:from-rose-950/20 dark:to-rose-950/10 border border-rose-500/20 p-4 rounded-xl flex items-center justify-between shadow-xs"
        >
          <div className="min-w-0 text-right">
             <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block mb-1">تنبيهات المخزون</span>
             <h4 className="text-lg md:text-xl font-extrabold text-rose-950 dark:text-rose-100 truncate">{lowStockCount} أصناف منخفضة</h4>
             <p className="text-[9px] text-rose-600 dark:text-rose-400 mt-1 font-medium">تحتاج تزويد وتوريد عاجل</p>
          </div>
          <div className="w-10 h-10 bg-rose-500/25 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center shrink-0 ml-2">
             <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* 🔮 أقسام النظام وإدارة الأداء الذكية */}
      <div className="space-y-4 text-right" dir="rtl">
        <h3 className="font-extrabold text-foreground text-sm md:text-base flex items-center gap-2 justify-start">
          <span>أقسام النظام الأساسية وإدارة الأداء</span>
          <span className="h-1.5 w-1.5 rounded-full bg-secondary shrink-0"></span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Card 1: Inventory & Stocks Department */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            onClick={() => navigate('/inventory')}
            className="group relative overflow-hidden bg-gradient-to-br from-white to-orange-50/10 dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 hover:border-orange-500/30 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-4 items-center"
          >
            {/* Visual background glow */}
            <div className="absolute -right-12 -top-12 w-28 h-28 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all duration-500" />
            
            <div className="flex-1 min-w-0 pr-1 text-right">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-orange-600 bg-orange-500/10 mb-2">
                نظام إدارة المخزون
              </span>
              <h4 className="text-sm md:text-base font-black text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">
                إدارة المخازن والمشتريات
              </h4>
              <p className="text-[10px] md:text-xs text-secondary mt-1 line-clamp-2 leading-relaxed">
                قائمة المنتجات والأصناف المتاحة، تنظيم الفئات، تزويد كميات الشراء وتنبيهات مستويات المخزون المنخفضة.
              </p>
              
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[10px] text-gray-400 font-bold">الحالة: {lowStockCount > 0 ? `${lowStockCount} أصناف منخفضة` : 'جاهز ومتوازن'}</span>
                {lowStockCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0"></span>}
              </div>
            </div>

            {/* Custom 3D Icon Fallback - Elegant Lucide Badge */}
            <div className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-110">
              <Package className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
            </div>
          </motion.div>

          {/* Card 2: Analytical Reports */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            onClick={() => navigate('/reports')}
            className="group relative overflow-hidden bg-gradient-to-br from-white to-blue-50/10 dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 hover:border-blue-500/30 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-4 items-center"
          >
            {/* Visual background glow */}
            <div className="absolute -right-12 -top-12 w-28 h-28 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-500" />
            
            <div className="flex-1 min-w-0 pr-1 text-right">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-blue-600 bg-blue-500/10 mb-2">
                التحليل والإحصائيات
              </span>
              <h4 className="text-sm md:text-base font-black text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                التقارير التحليلية والبيانية
              </h4>
              <p className="text-[10px] md:text-xs text-secondary mt-1 line-clamp-2 leading-relaxed">
                متابعة حركة المبيعات، ومراقبة عوائد الأرباح وحساب تكلفة البضاعة المباعة COGS وهامش الربح ودفاتر اليومية.
              </p>
              
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[10px] text-gray-400 font-bold">الوصول: تقارير فورية ودقيقة 100%</span>
              </div>
            </div>

            {/* Custom 3D Icon Fallback - Elegant Lucide Badge */}
            <div className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-110">
              <BarChart3 className="w-8 h-8 md:w-10 md:h-10" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* 📊 Sales Graphical Overview & Dashboard Widget */}
      <div className="bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden text-right animate-fade-in" dir="rtl" id="sales-graphic-widget">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-50 dark:border-slate-800/50">
          <div>
            <h3 className="font-bold text-primary flex items-center gap-2 justify-start text-base md:text-lg">
              <TrendingUp className="w-5 h-5 text-secondary" /> لوحة تحليل المبيعات والربحية الكلية التفاعلية
            </h3>
            <p className="text-xs text-secondary mt-1">تتبع مؤشرات الأداء المالي، وحجم الفواتير، والأرباح الصافية الحية ديناميكياً</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 justify-start">
            {/* Metric Tab Selector */}
            <div className="flex bg-gray-100 dark:bg-slate-900 border border-gray-200/50 dark:border-slate-800 p-1 rounded-xl shadow-inner select-none">
              <button
                type="button"
                onClick={() => setChartMetric('sales')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartMetric === 'sales'
                    ? 'bg-white dark:bg-slate-800 text-secondary border border-gray-200/40 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                💰 المبيعات
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('profit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartMetric === 'profit'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📈 الأرباح
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('invoices')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartMetric === 'invoices'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📄 الفواتير
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="flex bg-gray-100 dark:bg-slate-900 border border-gray-200/50 dark:border-slate-800 p-1 rounded-xl shadow-inner select-none flex-shrink-0">
              <button
                type="button"
                onClick={() => setChartPeriod(7)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartPeriod === 7
                    ? 'bg-[#3D2B1F]'
                    : 'text-gray-500 hover:text-[#3D2B1F]'
                }`}
                style={{ color: chartPeriod === 7 ? 'white' : 'inherit' }}
              >
                7 أيام
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod(15)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartPeriod === 15
                    ? 'bg-[#3D2B1F]'
                    : 'text-gray-500 hover:text-[#3D2B1F]'
                }`}
                style={{ color: chartPeriod === 15 ? 'white' : 'inherit' }}
              >
                15 يوم
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod(30)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                  chartPeriod === 30
                    ? 'bg-[#3D2B1F]'
                    : 'text-gray-500 hover:text-[#3D2B1F]'
                }`}
                style={{ color: chartPeriod === 30 ? 'white' : 'inherit' }}
              >
                30 يوم
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Values breakdown */}
          <div className="space-y-4 flex flex-col justify-center">
            {/* Interactive display box based on selected metric */}
            <div className="p-4 rounded-2xl border transition-all duration-300" style={{
              backgroundColor: chartMetric === 'sales' ? '#fdfbfc' : chartMetric === 'profit' ? '#f0fdf4' : '#eff6ff',
              borderColor: chartMetric === 'sales' ? '#f1f1f1' : chartMetric === 'profit' ? '#bbf7d0' : '#bfdbfe'
            }}>
              <span className="text-[10px] font-black uppercase block mb-1 font-sans" style={{
                color: chartMetric === 'sales' ? '#8B5E3C' : chartMetric === 'profit' ? '#15803d' : '#1d4ed8'
              }}>المعدل لآخر {chartPeriod} يوم</span>
              <div className="flex items-baseline gap-1.5 justify-start">
                <span className="text-xl md:text-2xl font-black font-sans" style={{
                  color: chartMetric === 'sales' ? '#32251D' : chartMetric === 'profit' ? '#166534' : '#1e40af'
                }}>
                  {(chartData.reduce((acc, row: any) => acc + (row[metricLabel] || 0), 0) / chartPeriod).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs font-bold text-gray-500">{metricUnit} / يوم</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                متوسط {metricLabel} اليومي المحسوب بناءً على مبيعات حركة الصندوق الحالية.
              </p>
            </div>

            {/* Today's Sales Box */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 bg-primary/5 border-primary/10 relative overflow-hidden group`}>
              <span className="text-[10px] font-black text-primary uppercase block mb-1">إجمالي مبيعات اليوم</span>
              <div className="flex items-baseline gap-1.5 justify-start">
                <span className="text-xl md:text-2xl font-extrabold text-[#3D2B1F]">{(dailySales || 0).toLocaleString()}</span>
                <span className="text-xs font-bold text-secondary">{shopSettings?.currency || 'ر.ي'}</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#8B5E3C] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, monthlySalesAmount > 0 ? (dailySales / monthlySalesAmount) * 100 : 0)}%` }}
                ></div>
              </div>
              <span className="text-[9px] text-secondary mt-1 block">
                تمثل {monthlySalesAmount > 0 ? ((dailySales / monthlySalesAmount) * 100).toFixed(1) : 0}% من إجمالي مبيعات الشهر
              </span>
            </div>

            {/* Current Month Sales Box */}
            <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 relative overflow-hidden group">
              <span className="text-[10px] font-black text-secondary uppercase block mb-1">إجمالي مبيعات الشهر الجاري</span>
              <div className="flex items-baseline gap-1.5 justify-start">
                <span className="text-xl md:text-2xl font-extrabold text-secondary">{(monthlySalesAmount || 0).toLocaleString()}</span>
                <span className="text-xs font-bold text-primary">{shopSettings?.currency || 'ر.ي'}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                <span>مجموع مبيعات شهر {new Date().toLocaleString('ar-YE', { month: 'long' })}</span>
              </div>
            </div>
          </div>

          {/* Graphical AreaChart */}
          <div className="lg:col-span-2 w-full min-w-0" style={{ height: "300px", minHeight: "250px" }} dir="ltr">
            {isMounted && (
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={250}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metricColor} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={metricColor} stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                    tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 'medium' }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    dx={-10}
                    tick={{ fill: '#4b5563', fontSize: 10 }}
                    tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
                  />
                  <Tooltip 
                    content={<CustomTooltip currency={shopSettings?.currency || 'ر.ي'} />}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={metricLabel} 
                    stroke={metricColor} 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorMetric)" 
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>



      {/* Financial Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="p-4 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-primary flex items-center gap-2">
                 <DollarSign className="w-5 h-5" /> سجل تحليل الأداء المالي
              </h3>
              <span className="text-[10px] bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-bold text-gray-500 uppercase tracking-widest">Real-time Analysis</span>
           </div>
           <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-right" dir="rtl">
                 {/* Step 1: Sales to Gross Profit */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">1</div>
                       <p className="text-xs font-bold text-gray-400">تحليل المبيعات والمخزون</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100/50 dark:border-slate-800 space-y-3">
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500 text-right">إجمالي المبيعات</span>
                          <span className="font-bold">{(stats.totalSales || 0).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs text-red-500">
                          <span className="text-right">تكلفة البضاعة (COGS)</span>
                          <span className="font-bold">- {((stats.totalSales || 0) - (stats.grossProfit || 0)).toLocaleString()}</span>
                       </div>
                       <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-between font-black text-primary">
                          <span className="text-right">ربح المبيعات</span>
                          <span>{(stats.grossProfit || 0).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 {/* Icon separator for desktop */}
                 <div className="hidden md:flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-300">
                       <Minus className="w-5 h-5 rotate-90" />
                    </div>
                 </div>

                 {/* Step 2: Gross Profit to Net Profit */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-red-50 text-red-650 flex items-center justify-center font-bold">2</div>
                       <p className="text-xs font-bold text-gray-400">تحليل المصاريف والتشغيل</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100/50 dark:border-slate-800 space-y-3">
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500 text-right">ربح المبيعات</span>
                          <span className="font-bold">{(stats.grossProfit || 0).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs text-red-500">
                          <span className="text-right">المصاريف والرواتب</span>
                          <span className="font-bold">- {(stats.totalExpenses || 0).toLocaleString()}</span>
                       </div>
                       <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-between font-black text-green-600">
                          <span className="text-right">صافي الربح</span>
                          <span>{(stats.netProfit || 0).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden text-right">
            <h3 className="font-bold text-foreground mb-4 text-sm md:text-base">أصناف منخفضة المخزون</h3>
            <div className="space-y-3 md:space-y-4">
               {stats.lowStock.length > 0 ? stats.lowStock.map((item: any, idx: number) => (
                 <div key={idx} className="flex items-center justify-between py-2 md:py-3 border-b border-gray-50 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors px-1 md:px-2 rounded-lg text-foreground">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                       <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 text-red-650 flex items-center justify-center rounded-lg shrink-0">
                          <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                       </div>
                       <div className="min-w-0 text-right">
                          <p className="text-xs md:text-sm font-bold text-foreground truncate">{item.name}</p>
                          <p className="text-[9px] md:text-[10px] text-gray-500 truncate">{item.code}</p>
                       </div>
                    </div>
                    <div className="text-left shrink-0">
                       <p className="text-xs md:text-sm font-bold text-red-600">{item.stock} {item.unit}</p>
                       <p className="text-[8px] md:text-[10px] text-gray-400">متبقية</p>
                    </div>
                 </div>
               )) : (
                 <div className="py-10 text-center text-gray-400 text-sm">لا توجد أصناف منخفضة المخزون حالياً</div>
               )}
            </div>
            {stats.lowStock.length > 0 && (
              <button 
                onClick={() => navigate('/inventory')}
                className="w-full mt-4 py-2 text-[10px] md:text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors border border-dashed border-primary/20 cursor-pointer"
              >
                انتقل لإدارة المخزون
              </button>
            )}
         </div>

         <div className="bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden text-right">
            <h3 className="font-bold text-foreground mb-4 text-sm md:text-base">آخر الفواتير</h3>
            <div className="space-y-3 md:space-y-4">
                {lastInvoices && lastInvoices.length > 0 ? lastInvoices.map((inv: any, i: number) => (
                 <div key={i} className="flex items-center gap-2 md:gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0 min-w-0" onClick={() => navigate('/sales')}>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 shrink-0"></div>
                    <div className="flex-1 min-w-0 text-right">
                       <p className="text-[10px] md:text-xs font-bold text-foreground truncate">{inv.number}</p>
                       <p className="text-[8px] md:text-[10px] text-gray-500 truncate">{new Date(inv.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-blue-600 shrink-0">{(inv.total || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}</p>
                 </div>
               )) : (
                 <div className="py-10 text-center text-gray-400 text-sm">لا توجد حركات مبيعات مؤخراً</div>
               )}
            </div>
            <button 
              onClick={() => navigate('/sales')}
              className="w-full mt-6 py-2 text-xs md:text-sm text-blue-700 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors cursor-pointer border-none"
            >
               عرض كافة الفواتير
            </button>
         </div>
      </div>

      {/* Developer Credit Footer */}
      <div className="pt-8 pb-4 text-center text-xs text-secondary border-t border-gray-100 dark:border-slate-800/55 mt-8">
         <p>تطوير المهندس: <span className="font-bold text-gray-700 dark:text-gray-300">مازن فارع</span></p>
      </div>
    </div>
  );
}
