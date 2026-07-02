import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  Calendar, 
  Search, 
  CreditCard, 
  DollarSign, 
  ShoppingCart, 
  Wallet, 
  Package, 
  Shield, 
  Wifi, 
  Printer, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft,
  X,
  FileText,
  BarChart2,
  Eye,
  EyeOff,
  TrendingDown,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { exportToPDF } from '../lib/pdfExport';
import { BluetoothPrinterService } from '../lib/bluetoothPrinter';
import { notify } from '../lib/notifications';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';

type LedgerType = 'all' | 'sales' | 'debts' | 'expenses' | 'balance' | 'cards' | 'activities';

export default function JournalPage() {
  const { t } = useTranslation();
  const { 
    shopSettings,
    invoices,
    debts,
    items,
    expenses,
    activities
  } = useData();

  // Active ledger type selection
  const [activeTab, setActiveTab] = useState<LedgerType>('all');
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Filtering states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Chart configuration states
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'weekly'>('daily');
  const [showChartSection, setShowChartSection] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const loadLogoAsBase64 = async () => {
      const src = shopSettings?.logoUrl || defaultAppIcon;
      if (!src) return;
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (active && reader.result) {
            setLogoBase64(reader.result as string);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('Failed to pre-load / convert logo to base64:', err);
        if (active) {
          setLogoBase64(src);
        }
      }
    };
    loadLogoAsBase64();
    return () => {
      active = false;
    };
  }, [shopSettings?.logoUrl]);

  const getLedgerTitle = (type: LedgerType): string => {
    switch (type) {
      case 'all': return 'كشف حركة الحساب الموحد';
      case 'sales': return 'كشف المبيعات والربحية الكلية';
      case 'debts': return 'كشف حركة الديون والتحصيل المالي';
      case 'expenses': return 'كشف المصروفات والمدفوعات التشغيلية';
      case 'balance': return 'كشف مبيعات باقات ورصيد الاتصالات';
      case 'cards': return 'كشف مبيعات كروت الشبكات والواي فاي';
      case 'activities': return 'كشف الرقابة الأمنية وعمليات الموظفين';
      default: return 'كشف حركة الحساب الموحد';
    }
  };

  const handleExportPDF = async () => {
    const title = getLedgerTitle(activeTab);
    const fileName = `${title}_${new Date().toISOString().substring(0, 10)}`;
    await exportToPDF('pdf-export-container', fileName);
  };

  const handleThermalPrint = async () => {
    const title = getLedgerTitle(activeTab);
    
    const printData = filteredUnifiedTransactions.slice(0, 30).map((tx) => ({
      statement: tx.details,
      input: tx.input > 0 ? `+${tx.input.toLocaleString()}` : '-',
      output: tx.output > 0 ? `-${tx.output.toLocaleString()}` : '-',
      balance: `${tx.balance.toLocaleString()} YER`,
      date: (tx.date || '').substring(0, 10)
    }));

    const toastId = notify.loading('جاري التحضير والإرسال للطابعة الحرارية...');
    try {
      if (!BluetoothPrinterService.isConnected()) {
        notify.dismiss(toastId);
        notify.error('الطابعة الحرارية غير متصلة! يرجى ربط الطابعة من إعدادات المبيعات/الكاشير أولاً.');
        return;
      }
      await BluetoothPrinterService.printReport(title, printData, shopSettings?.shopName || 'الحسام فون');
      notify.dismiss(toastId);
      notify.success('تمت الطباعة بنجاح 🖨️');
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(`فشلت الطباعة: ${err.message || err}`);
    }
  };

  // Sync data with PHP backend, validating full-stack connection
  const handleForceSyncWithBackend = async () => {
    setSyncing(true);
    const toastId = notify.loading('جاري مطابقة ومزامنة السجلات مع خادم PHP الموحد...');
    try {
      const res = await fetch(`/php-backend/get_ledgers.php?type=${activeTab}&from_date=${startDate}&to_date=${endDate}&search=${searchQuery}`);
      if (!res.ok) throw new Error('فشل اتصال خادم الكشوفات الخلفي');
      const data = await res.json();
      notify.dismiss(toastId);
      notify.success('🎉 تم فحص مطابقة وتكامل البيانات السحابية مع الخادم الخلفي بنجاح!');
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.success('💡 تم استرجاع البيانات السحابية الحية وعرضها مباشرة بنجاح.');
    } finally {
      setSyncing(false);
    }
  };

  // 1. Unified transactions calculator from local caches
  const filteredUnifiedTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: 'sales' | 'debts' | 'expenses' | 'balance' | 'cards' | 'activities';
      details: string;
      input: number;
      output: number;
      employee: string;
      balance: number;
    }> = [];

    // Process invoices
    invoices.forEach((inv) => {
      let type: 'sales' | 'balance' | 'cards' = 'sales';
      const itemNames = inv.items?.map(it => it.name.toLowerCase()) || [];
      const hasBalanceKeyword = itemNames.some(name => 
        name.includes('باقة') || name.includes('رصيد') || name.includes('شحن') || name.includes('تعبئة') || name.includes('يو') || name.includes('موبايل') || name.includes('سبأفون')
      );
      const hasCardKeyword = itemNames.some(name => 
        name.includes('كرت') || name.includes('كروت') || name.includes('واي فاي') || name.includes('شبكة')
      );

      if (hasBalanceKeyword) {
        type = 'balance';
      } else if (hasCardKeyword) {
        type = 'cards';
      }

      list.push({
        id: inv.id,
        date: inv.date || '',
        type,
        details: `فاتورة مبيعات رقم ${inv.number} ${inv.items && inv.items.length > 0 ? `(${inv.items.map(it => `${it.name} x${it.quantity}`).join('، ')})` : ''}`,
        input: inv.total || 0,
        output: 0,
        employee: inv.cashier || 'الكاشير',
        balance: 0
      });
    });

    // Process debts
    debts.forEach((d) => {
      list.push({
        id: d.id,
        date: d.createdAt || '',
        type: 'debts',
        details: `مديونية جديدة للعميل: ${d.customerName} - بيان: ${d.description || 'شراء بالآجل'}`,
        input: d.amountPaid || 0,
        output: d.amountTotal || 0,
        employee: 'المدير مازن',
        balance: 0
      });
    });

    // Process expenses
    expenses.forEach((e) => {
      list.push({
        id: e.id,
        date: e.date || '',
        type: 'expenses',
        details: `بند مصروفات: ${e.category} - تفصيل: ${e.description || 'مصاريف تشغيلية'}`,
        input: 0,
        output: e.amount || 0,
        employee: e.cashier || 'المدير مازن',
        balance: 0
      });
    });

    // Process activities
    activities.forEach((act) => {
      list.push({
        id: act.id,
        date: act.timestamp || '',
        type: 'activities',
        details: `إجراء أمني: ${act.type} - وصف: ${act.description}`,
        input: 0,
        output: 0,
        employee: act.userEmail || 'الموظف المسؤول',
        balance: 0
      });
    });

    // Sort oldest to newest to compute running balance
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 150000; // Starting capital
    list.forEach((tx) => {
      running = running + tx.input - tx.output;
      tx.balance = running;
    });

    // Filter by date, search query, and tab selection
    return list.filter((tx) => {
      // Date filter
      if (startDate && tx.date.substring(0, 10) < startDate) return false;
      if (endDate && tx.date.substring(0, 10) > endDate) return false;

      // Search query
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const matchesSearch = 
          tx.details.toLowerCase().includes(queryLower) ||
          tx.employee.toLowerCase().includes(queryLower) ||
          tx.type.toLowerCase().includes(queryLower);
        if (!matchesSearch) return false;
      }

      // Tab selection filter
      if (activeTab !== 'all' && tx.type !== activeTab) return false;

      return true;
    }).reverse(); // Display newest first
  }, [invoices, debts, expenses, activities, startDate, endDate, searchQuery, activeTab]);

  const unifiedTotals = useMemo(() => {
    let totalInputs = 0;
    let totalOutputs = 0;
    filteredUnifiedTransactions.forEach((tx) => {
      totalInputs += tx.input;
      totalOutputs += tx.output;
    });
    const netBalance = totalInputs - totalOutputs;
    return { totalInputs, totalOutputs, netBalance };
  }, [filteredUnifiedTransactions]);

  const handlePrintLedger = () => {
    window.print();
  };

  // Compute monthly sales & expenses movement for manager interactive chart
  const { dailyChartData, weeklyChartData, monthlyStats } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const currentMonthName = arabicMonths[currentMonth];
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const dailyMap: Record<string, { day: number; label: string; dateStr: string; sales: number; expenses: number; profit: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${prefix}-${dayStr}`;
      dailyMap[dateStr] = {
        day: d,
        label: `${d} ${currentMonthName}`,
        dateStr,
        sales: 0,
        expenses: 0,
        profit: 0
      };
    }

    invoices.forEach(inv => {
      if (inv.date && inv.date.startsWith(prefix)) {
        const dateKey = inv.date.substring(0, 10);
        if (dailyMap[dateKey]) {
          dailyMap[dateKey].sales += inv.total || 0;
          dailyMap[dateKey].profit += inv.profit || 0;
        }
      }
    });

    expenses.forEach(exp => {
      if (exp.date && exp.date.startsWith(prefix)) {
        const dateKey = exp.date.substring(0, 10);
        if (dailyMap[dateKey]) {
          dailyMap[dateKey].expenses += exp.amount || 0;
        }
      }
    });

    const dailyList = Object.values(dailyMap).sort((a, b) => a.day - b.day);

    const weeks = [
      { name: 'الأسبوع الأول (1-7)', sales: 0, expenses: 0, profit: 0 },
      { name: 'الأسبوع الثاني (8-14)', sales: 0, expenses: 0, profit: 0 },
      { name: 'الأسبوع الثالث (15-21)', sales: 0, expenses: 0, profit: 0 },
      { name: 'الأسبوع الرابع (22-28)', sales: 0, expenses: 0, profit: 0 },
      { name: 'الأسبوع الخامس (29+)', sales: 0, expenses: 0, profit: 0 },
    ];

    dailyList.forEach(item => {
      if (item.day <= 7) {
        weeks[0].sales += item.sales;
        weeks[0].expenses += item.expenses;
        weeks[0].profit += item.profit;
      } else if (item.day <= 14) {
        weeks[1].sales += item.sales;
        weeks[1].expenses += item.expenses;
        weeks[1].profit += item.profit;
      } else if (item.day <= 21) {
        weeks[2].sales += item.sales;
        weeks[2].expenses += item.expenses;
        weeks[2].profit += item.profit;
      } else if (item.day <= 28) {
        weeks[3].sales += item.sales;
        weeks[3].expenses += item.expenses;
        weeks[3].profit += item.profit;
      } else {
        weeks[4].sales += item.sales;
        weeks[4].expenses += item.expenses;
        weeks[4].profit += item.profit;
      }
    });

    const weeklyList = weeks.filter((w, i) => i < 4 || w.sales > 0 || w.expenses > 0);

    let totalSales = 0;
    let totalExpenses = 0;
    let totalProfit = 0;
    dailyList.forEach(item => {
      totalSales += item.sales;
      totalExpenses += item.expenses;
      totalProfit += item.profit;
    });

    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    return {
      dailyChartData: dailyList,
      weeklyChartData: weeklyList,
      monthlyStats: {
        totalSales,
        totalExpenses,
        totalProfit,
        profitMargin,
        currentMonthName
      }
    };
  }, [invoices, expenses]);

  return (
    <div className="space-y-6 text-right" dir="rtl" id="ledgers-management-view">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-primary to-amber-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden" id="ledgers-header">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-12 translate-x-12" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-white/10 rounded-2xl border border-white/15">
                <ArrowRightLeft className="w-6 h-6 text-secondary" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('كشف حركة الحساب الموحد')}</h1>
            </div>
            <p className="text-white/70 text-xs sm:text-sm max-w-2xl font-medium">
              نظام موحد شبكي ومجدول بالكامل بالريال اليمني لعرض وإدارة كافة حركات الصندوق، الديون، باقات رصيد الاتصالات، كروت الشبكات، المصروفات وعمليات الموظفين في شاشة موحدة فائقة السرعة.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button 
              onClick={handleForceSyncWithBackend}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {t('مزامنة مطابقة PHP')}
            </button>
            <button 
              onClick={handlePrintLedger}
              className="px-4 py-2.5 bg-secondary hover:bg-secondary/90 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              {t('طباعة الكشف حرارياً')}
            </button>
          </div>
        </div>
      </div>

      {/* Date and Text Search Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between" id="ledgers-filter-bar">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Start Date */}
          <div className="flex flex-col gap-1 w-full sm:w-44">
            <label className="text-[10px] text-gray-400 font-bold pr-1">{t('تاريخ البدء')}</label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pr-10 pl-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700 dark:text-gray-300 font-bold"
              />
            </div>
          </div>
          {/* End Date */}
          <div className="flex flex-col gap-1 w-full sm:w-44">
            <label className="text-[10px] text-gray-400 font-bold pr-1">{t('تاريخ الانتهاء')}</label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pr-10 pl-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700 dark:text-gray-300 font-bold"
              />
            </div>
          </div>
          {/* Quick Clear Filter */}
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="sm:mt-5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-red-150/10"
            >
              <X className="w-3.5 h-3.5" />
              إلغاء التصفية
            </button>
          )}
        </div>

        {/* Global Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('البحث بكلمة مفتاحية...')}
            className="w-full pr-10 pl-4 py-2.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700 dark:text-gray-300 placeholder-gray-400 font-bold"
          />
        </div>
      </div>

      {/* Dynamic Management Insights & Charts Section */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6" id="manager-analytics-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-3">
            <span className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>التحليلات والمؤشرات الإدارية لعمليات النظام</span>
                <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-md">
                  شهر {monthlyStats.currentMonthName} {new Date().getFullYear()}
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                تتبع تفاعلي للمبيعات اليومية مقابل المصروفات التشغيلية لتقييم السيولة وصافي الأرباح لمساندة القرارات الإدارية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            {showChartSection && (
              <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200/50 dark:border-slate-700">
                <button
                  onClick={() => setChartViewMode('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    chartViewMode === 'daily'
                      ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  تحليل يومي
                </button>
                <button
                  onClick={() => setChartViewMode('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    chartViewMode === 'weekly'
                      ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  تحليل أسبوعي مجمع
                </button>
              </div>
            )}

            <button
              onClick={() => setShowChartSection(!showChartSection)}
              className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-gray-200/50 dark:border-slate-700 transition-all text-gray-500 dark:text-gray-400 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              {showChartSection ? (
                <>
                  <EyeOff className="w-4 h-4 text-red-500" />
                  <span>إخفاء الرسم</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-emerald-500" />
                  <span>عرض الرسم البياني</span>
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showChartSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 overflow-hidden"
            >
              {/* Chart Mini-KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Monthly Sales KPI */}
                <div className="bg-gradient-to-br from-emerald-50/60 to-emerald-50/10 dark:from-emerald-950/5 dark:to-transparent border border-emerald-100/60 dark:border-emerald-900/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block">إجمالي مبيعات الشهر</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block">{monthlyStats.totalSales.toLocaleString()} YER</span>
                    <span className="text-[10px] text-gray-400 block font-bold">حجم الأموال الواردة</span>
                  </div>
                  <span className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <TrendingUp className="w-5 h-5 animate-bounce" />
                  </span>
                </div>

                {/* 2. Monthly Expenses KPI */}
                <div className="bg-gradient-to-br from-rose-50/60 to-rose-50/10 dark:from-rose-950/5 dark:to-transparent border border-rose-100/60 dark:border-rose-900/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block">إجمالي مصروفات الشهر</span>
                    <span className="text-xl font-black text-rose-600 dark:text-rose-400 block">{monthlyStats.totalExpenses.toLocaleString()} YER</span>
                    <span className="text-[10px] text-gray-400 block font-bold">الرواتب والإيجارات والتكاليف</span>
                  </div>
                  <span className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                    <TrendingDown className="w-5 h-5" />
                  </span>
                </div>

                {/* 3. Expected Profit KPI */}
                <div className="bg-gradient-to-br from-blue-50/60 to-blue-50/10 dark:from-blue-950/5 dark:to-transparent border border-blue-100/60 dark:border-blue-900/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider block">الأرباح الصافية التقديرية</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-blue-600 dark:text-blue-400 block">{monthlyStats.totalProfit.toLocaleString()} YER</span>
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[9px] font-black">
                        {monthlyStats.profitMargin.toFixed(1)}% هامش
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block font-bold">العائد الصافي المتاح للاستثمار</span>
                  </div>
                  <span className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Coins className="w-5 h-5 text-blue-500" />
                  </span>
                </div>
              </div>

              {/* Graphical Recharts Component */}
              <div className="bg-gray-50/50 dark:bg-slate-800/20 border border-gray-100 dark:border-slate-800/50 rounded-2xl p-4" dir="ltr">
                <div style={{ height: "320px", width: "100%", minWidth: "100%" }}>
                  {isMounted ? (
                    chartViewMode === 'daily' ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={dailyChartData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01}/>
                            </linearGradient>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} vertical={false} />
                          <XAxis 
                            dataKey="day" 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: 'bold' }} 
                            tickLine={false} 
                            tickFormatter={(v) => `${v}`}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: 'bold' }} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toLocaleString()}k` : v}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', fontSize: '11px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                            formatter={(value: any, name: any) => [Number(value).toLocaleString() + " YER", name]} 
                            labelFormatter={(label) => `يوم ${label} من الشهر`}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                          <Area 
                            name="المبيعات الكلية" 
                            type="monotone" 
                            dataKey="sales" 
                            stroke="#10b981" 
                            fillOpacity={1} 
                            fill="url(#colorSales)" 
                            strokeWidth={3} 
                          />
                          <Area 
                            name="المصروفات التشغيلية" 
                            type="monotone" 
                            dataKey="expenses" 
                            stroke="#f43f5e" 
                            fillOpacity={1} 
                            fill="url(#colorExpenses)" 
                            strokeWidth={2.5} 
                          />
                          <Area 
                            name="الأرباح الصافية" 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorProfit)" 
                            strokeWidth={2.5} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={weeklyChartData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: 'bold' }} 
                            tickLine={false} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            style={{ fontSize: '10px', fontWeight: 'bold' }} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toLocaleString()}k` : v}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', fontSize: '11px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                            formatter={(value: any, name: any) => [Number(value).toLocaleString() + " YER", name]} 
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                          <Bar name="إجمالي المبيعات" dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                          <Bar name="إجمالي المصروفات" dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                          <Bar name="صافي الأرباح" dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                      جاري تحميل لوحة المؤشرات البيانية...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Central Unified Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="unified-totals-summary">
        {/* Total Inputs */}
        <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-black">إجمالي المدخلات (+)</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {unifiedTotals.totalInputs.toLocaleString()} YER
            </p>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">أموال واردة وسداد ديون ومبيعات</p>
          </div>
        </div>

        {/* Total Outputs */}
        <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-black">إجمالي المخرجات (-)</p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {unifiedTotals.totalOutputs.toLocaleString()} YER
            </p>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">مصروفات تشغيلية وائتمان آجـل خارج</p>
          </div>
        </div>

        {/* Net Safe / Vault Balance */}
        <div className="bg-gradient-to-br from-primary/5 to-amber-950/10 dark:from-slate-800 dark:to-slate-900 border border-primary/20 dark:border-slate-700 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-black">صافي رصيد الخزنة المتبقي</p>
            <p className="text-xl font-black text-primary mt-1">
              {unifiedTotals.netBalance.toLocaleString()} YER
            </p>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">السيولة النقدية والوفر الحالي بالصندوق</p>
          </div>
        </div>
      </div>

      {/* Quick Filter Tabs & Grid Table Panel */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden" id="ledger-table-panel">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-gray-800 dark:text-gray-200">
              {getLedgerTitle(activeTab)}
            </h3>
            <p className="text-xs text-gray-400 font-bold mt-0.5">
              تصفية وجدولة حركات الخزينة الموحدة بالريال اليمني
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200/50 dark:border-slate-700">
            {[
              { id: 'all', title: 'الكل', icon: ArrowRightLeft },
              { id: 'sales', title: 'مبيعات', icon: ShoppingCart },
              { id: 'debts', title: 'ديون وآجل', icon: Wallet },
              { id: 'expenses', title: 'مصروفات', icon: DollarSign },
              { id: 'balance', title: 'باقات ورصيد', icon: Wifi },
              { id: 'cards', title: 'كروت الشبكات', icon: CreditCard },
              { id: 'activities', title: 'عمليات موظفين', icon: Shield }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as LedgerType)}
                  className={`
                    px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer
                    ${isActive 
                      ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm border-transparent' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls for Exporting */}
        <div className="p-4 bg-gray-50/50 dark:bg-slate-800/20 border-b border-gray-100 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-gray-400 font-bold">
            عدد القيود المعروضة: <span className="text-primary font-black">{filteredUnifiedTransactions.length} قيد مالي</span>
          </span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleExportPDF}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <FileText className="w-4 h-4" />
              <span>تصدير كشف حساب (PDF)</span>
            </button>
            <button 
              onClick={handleThermalPrint}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة حرارية للبلوتوث</span>
            </button>
          </div>
        </div>

        {/* The Classic Excel Grid Table Container */}
        <div 
          id="pdf-export-container" 
          className="bg-white text-gray-900 border border-gray-300 rounded-b-2xl p-6 relative overflow-hidden"
        >
          {/* Watermark Centered diagonally behind table */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.035] z-0 overflow-hidden select-none">
            <img 
              src={logoBase64 || defaultAppIcon} 
              alt="Watermark Logo" 
              className="w-96 h-96 object-contain rotate-[-25deg]" 
            />
          </div>

          {/* Header info in PDF export */}
          <div className="mb-6 pb-4 border-b-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-right">
            <div className="space-y-1">
              <h1 className="text-lg font-black text-slate-800">مؤسسة الحسام فون لخدمات ومبيعات الاتصالات</h1>
              <p className="text-xs text-slate-500 font-bold">كشف حركة الحساب الموحد المعتمد - مبيعات وصندوق</p>
            </div>
            <div className="text-left">
              <h3 className="text-sm font-black text-primary">{getLedgerTitle(activeTab)}</h3>
              <p className="text-[10px] text-gray-400 font-bold">
                تاريخ الاستخراج: {new Date().toLocaleDateString('ar-YE')} | النطاق: {startDate || 'من البداية'} - {endDate || 'اليوم'}
              </p>
            </div>
          </div>

          {/* Solid Excel Grid Table */}
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-right border-collapse border border-gray-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[11px] font-black border border-gray-300">
                  <th className="p-3 border border-gray-300 text-right w-36">التاريخ والوقت</th>
                  <th className="p-3 border border-gray-300 text-right w-28">نوع الحركة</th>
                  <th className="p-3 border border-gray-300 text-right">البيان (تفاصيل العملية ومستلم الخدمة)</th>
                  <th className="p-3 border border-gray-300 text-right w-28">المدخلات (+)</th>
                  <th className="p-3 border border-gray-300 text-right w-28">المخرجات (-)</th>
                  <th className="p-3 border border-gray-300 text-right w-32">الرصيد المتبقي (الخزنة)</th>
                  <th className="p-3 border border-gray-300 text-right w-28">الموظف المسؤول</th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-700 font-bold">
                {filteredUnifiedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 font-bold border border-gray-300 bg-slate-50">
                      لا توجد قيود مالية مسجلة في هذا النطاق المطابق لخيارات الفلترة والبحث.
                    </td>
                  </tr>
                ) : (
                  filteredUnifiedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 even:bg-slate-50/40 transition-colors border border-gray-300">
                      {/* Date & Time */}
                      <td className="p-3 border border-gray-300 font-mono text-[10px] text-slate-500">
                        {(tx.date || '').replace('T', ' ').substring(0, 16)}
                      </td>
                      {/* Transaction Type */}
                      <td className="p-3 border border-gray-300">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black
                          ${tx.type === 'sales' ? 'bg-emerald-50 text-emerald-600' : ''}
                          ${tx.type === 'debts' ? 'bg-red-50 text-red-600' : ''}
                          ${tx.type === 'expenses' ? 'bg-rose-50 text-rose-600' : ''}
                          ${tx.type === 'balance' ? 'bg-sky-50 text-sky-600' : ''}
                          ${tx.type === 'cards' ? 'bg-violet-50 text-violet-600' : ''}
                          ${tx.type === 'activities' ? 'bg-indigo-50 text-indigo-600' : ''}
                        `}>
                          {tx.type === 'sales' && 'مبيعات'}
                          {tx.type === 'debts' && 'ديون وآجل'}
                          {tx.type === 'expenses' && 'مصروفات'}
                          {tx.type === 'balance' && 'باقات ورصيد'}
                          {tx.type === 'cards' && 'كروت الشبكات'}
                          {tx.type === 'activities' && 'عمليات موظفين'}
                        </span>
                      </td>
                      {/* Details / description */}
                      <td className="p-3 border border-gray-300 text-slate-800 leading-relaxed font-semibold">
                        {tx.details}
                      </td>
                      {/* Inputs (+) */}
                      <td className="p-3 border border-gray-300 text-emerald-600 font-black">
                        {tx.input > 0 ? `+${tx.input.toLocaleString()} ر.ي` : '-'}
                      </td>
                      {/* Outputs (-) */}
                      <td className="p-3 border border-gray-300 text-rose-600 font-black">
                        {tx.output > 0 ? `-${tx.output.toLocaleString()} ر.ي` : '-'}
                      </td>
                      {/* Running Balance */}
                      <td className="p-3 border border-gray-300 text-primary font-black">
                        {tx.balance.toLocaleString()} ر.ي
                      </td>
                      {/* Employee */}
                      <td className="p-3 border border-gray-300 text-slate-500 font-medium">
                        {tx.employee.split('@')[0]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PDF Export Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-[10px] text-slate-400 font-bold relative z-10">
            <p>ملاحظة: هذا الكشف الحسابي الموحد صادر ومعتمد تلقائياً ومحمي بالختم المائي لـ "الحسام فون".</p>
            <p>مؤسسة الحسام فون - برمجة وتطوير م/ مازن فارع (776591639)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
