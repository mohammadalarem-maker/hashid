import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  ArrowUpRight,
  DollarSign,
  Calendar,
  RefreshCw,
  Clock,
  Printer,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { exportToPDF } from '../lib/pdfExport';

export default function Reports() {
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<number>(30); // 30 Days

  useEffect(() => {
    let settingsDone = false;
    let itemsDone = false;
    let expensesDone = false;
    let invoicesDone = false;
    let paymentsDone = false;
    let debtsDone = false;

    const checkLoading = () => {
      if (settingsDone && itemsDone && expensesDone && invoicesDone && paymentsDone && debtsDone) {
        setLoading(false);
      }
    };

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setShopSettings(snap.data());
      settingsDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports settings subscription error:", err);
      settingsDone = true;
      checkLoading();
    });

    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map(d => d.data()));
      itemsDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports items subscription error:", err);
      itemsDone = true;
      checkLoading();
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => d.data()));
      expensesDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports expenses subscription error:", err);
      expensesDone = true;
      checkLoading();
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      setInvoices(snap.docs.map(d => d.data()));
      invoicesDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports invoices subscription error:", err);
      invoicesDone = true;
      checkLoading();
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(d => d.data()));
      paymentsDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports payments subscription error:", err);
      paymentsDone = true;
      checkLoading();
    });

    const unsubDebts = onSnapshot(collection(db, 'debts'), (snap) => {
      setDebts(snap.docs.map(d => d.data()));
      debtsDone = true;
      checkLoading();
    }, (err) => {
      console.warn("Reports debts subscription error:", err);
      debtsDone = true;
      checkLoading();
    });

    return () => {
      unsubSettings();
      unsubItems();
      unsubExpenses();
      unsubInvoices();
      unsubPayments();
      unsubDebts();
    };
  }, []);

  // Compute stats based on range
  const now = new Date();
  const filterByRange = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= selectedRange;
  };

  const rangeInvoices = invoices.filter(inv => filterByRange(inv.date));
  const rangeExpenses = expenses.filter(exp => filterByRange(exp.date));
  const rangePayments = payments.filter(pay => filterByRange(pay.date));
  const rangeDebts = debts.filter(deb => filterByRange(deb.createdAt));

  const totalSales = rangeInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalExpenses = rangeExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // Real Cogs
  const grossProfit = rangeInvoices.reduce((sum, inv) => {
    const cogs = (inv.items || []).reduce((csum: number, it: any) => csum + ((it.purchasePrice || 0) * (it.qty || 0)), 0);
    const revenue = inv.subtotal || inv.total || 0;
    return sum + (revenue - cogs);
  }, 0);

  const netProfit = grossProfit - totalExpenses;

  const totalPaymentsCollected = rangePayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalDebtsCount = rangeDebts.reduce((sum, d) => sum + (d.amountRemaining || 0), 0);

  const downloadReport = async () => {
    await exportToPDF('reports-main-content', `financial_report_${selectedRange}_days`);
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-bold">جاري إعداد التقارير المحاسبية...</span>
      </div>
    );
  }

  // Calculate Chart data mapping daily
  const getChartData = () => {
    const data = [];
    const daysWeekAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const count = selectedRange <= 15 ? selectedRange : 15; // limit bar details to fit mobile screens nicely
    
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const name = selectedRange <= 7 ? daysWeekAr[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`;

      const dayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(dateStr));
      const daySales = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const dayExpenses = expenses.filter(exp => exp.date && exp.date.startsWith(dateStr)).reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const dayProfit = dayInvoices.reduce((sum, inv) => {
        const cogs = (inv.items || []).reduce((csum: number, it: any) => csum + ((it.purchasePrice || 0) * (it.qty || 0)), 0);
        const rev = inv.subtotal || inv.total || 0;
        return sum + (rev - cogs);
      }, 0) - dayExpenses;

      data.push({
        name,
        'المبيعات': daySales,
        'المصاريف': dayExpenses,
        'صافي الصندوق': dayProfit
      });
    }
    return data;
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6 text-right pb-20 md:pb-6" dir="rtl" id="reports-main-content">
      
      {/* Title Header */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <BarChart3 className="w-6 h-6" />
           </div>
           <div className="text-right">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">التقارير التحليلية والبيانية</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">تحليل تكاليف المبيعات والربحة الكلية والصافية بصورة فورية 100%</p>
           </div>
         </div>

         <div className="flex items-center gap-2 print:hidden">
            {/* Range Select */}
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-gray-150 rounded-xl text-xs font-bold py-2.5 px-3 focus:outline-none cursor-pointer text-foreground"
            >
               <option value={7}>آخر 7 أيام</option>
               <option value={15}>آخر 15 يوماً</option>
               <option value={30}>آخر 30 يوماً</option>
               <option value={90}>آخر 3 أشهر</option>
            </select>
            
            <button
              onClick={downloadReport}
              className="px-4 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-opacity-90 flex items-center gap-1.5 cursor-pointer border-none shadow-sm shrink-0"
              id="download-pdf-report-btn"
            >
               <FileText className="w-4 h-4" /> تحميل نسخة PDF
            </button>
         </div>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-4 shadow-xs text-right select-none">
            <span className="text-[10px] font-bold text-gray-400 block mb-1">المبيعات الإجمالية</span>
            <span className="text-base md:text-xl font-black text-primary font-mono">{totalSales.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
         </div>
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-4 shadow-xs text-right select-none">
            <span className="text-[10px] font-bold text-gray-400 block mb-1">المصاريف الكلية</span>
            <span className="text-base md:text-xl font-black text-red-600 font-mono">{totalExpenses.toLocaleString()} {shopSettings?.currency || 'ر.i'}</span>
         </div>
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-4 shadow-xs text-right select-none">
            <span className="text-[10px] font-bold text-gray-400 block mb-1">هامش ربح المبيعات</span>
            <span className="text-base md:text-xl font-black text-emerald-600 font-mono">{grossProfit.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
         </div>
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-4 shadow-xs text-right select-none">
            <span className="text-[10px] font-bold text-gray-400 block mb-1">الأرباح الصافية (Net)</span>
            <span className={`text-base md:text-xl font-black font-mono ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
               {netProfit.toLocaleString()} {shopSettings?.currency || 'ر.ي'}
            </span>
         </div>
      </div>

      {/* Graphical Breakdown Chart */}
      <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden text-right">
        <h3 className="font-bold text-primary mb-6 flex items-center gap-1.5">📊 حركة الصندوق الإجمالية اليومية مقارنة بالمصاريف</h3>
        
        <div className="w-full" style={{ height: "300px", minHeight: "250px" }} dir="ltr">
           <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={250}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 'medium' }} tickLine={false} axisLine={false} />
                 <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${v/1000}K` : v} />
                 <Tooltip />
                 <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                 <Bar dataKey="المبيعات" fill="#8B5E3C" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="المصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="صافي الصندوق" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      {/* Analytics extra widgets list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Invoices statistics details list */}
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-5 md:p-6 shadow-sm text-right">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-xs md:text-sm">تفاصيل وحجم الفواتير</h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center py-2.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-400 font-bold">إجمالي الفواتير المصدرة</span>
                  <span className="font-black text-gray-800 dark:text-gray-200">{rangeInvoices.length} فواتير</span>
               </div>
               <div className="flex justify-between items-center py-2.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-400 font-bold">متوسط قيمة الفاتورة المصدرة</span>
                  <span className="font-black text-gray-800 dark:text-gray-200">
                     {rangeInvoices.length > 0 ? (totalSales / rangeInvoices.length).toLocaleString(undefined, { maximumFractionDigits: 1 }) : 0} {shopSettings?.currency || 'ر.ي'}
                  </span>
               </div>
               <div className="flex justify-between items-center py-2.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-400 font-bold">إجمالي المدفوعات المستحصلة</span>
                  <span className="font-black text-emerald-600 font-mono">+{totalPaymentsCollected.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
               </div>
               <div className="flex justify-between items-center py-2.5 text-xs">
                  <span className="text-gray-400 font-bold">الديون والدمم الباقية مستجدة</span>
                  <span className="font-black text-red-600 font-mono">+{totalDebtsCount.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
               </div>
            </div>
         </div>

         {/* Fast diagnostic recommendations */}
         <div className="bg-surface rounded-2xl border border-gray-150 dark:border-slate-800 p-5 md:p-6 shadow-sm text-right relative overflow-hidden flex flex-col justify-between">
            <div>
               <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 text-xs md:text-sm">خيارات الفحص الذاتي المحاسبي</h3>
               <p className="text-[11px] text-gray-500 leading-relaxed font-bold">يقوم النظام بتحليل نسبة المصروفات والرواتب مقارنة بإجمالي مبيع المحل.</p>
               
               <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-150/40 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                     <span className="text-gray-400">نسبة المصروف التشغيلي</span>
                     <span className={totalSales > 0 ? (totalExpenses / totalSales) * 100 > 25 ? "text-red-500" : "text-emerald-600" : "text-gray-500"}>
                        {totalSales > 0 ? ((totalExpenses / totalSales) * 100).toFixed(1) : 0}% 
                     </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                     <div 
                       className="bg-[#8B5E3C] h-full rounded-full transition-all duration-500" 
                       style={{ width: `${Math.min(100, totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0)}%` }}
                     ></div>
                  </div>
               </div>
            </div>

            <p className="text-[9.5px] text-gray-400 leading-normal mt-4">
               تلميح: ينصح المحاسب المالي بألا يتجاوز مجموع المصاريف والرواتب التشغيلية حد الـ 20% من مجمل المبيعات للحفاظ على مستويات سيولة كافية.
            </p>
         </div>
      </div>

    </div>
  );
}
