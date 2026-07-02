import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Plus, 
  Printer, 
  Search, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Database, 
  AlertTriangle, 
  Layers, 
  Coins, 
  PlusCircle,
  PhoneCall,
  User,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, getAbsoluteUrl } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { BluetoothPrinterService } from '../lib/bluetoothPrinter';
import { useConfirm } from '../lib/ConfirmContext';

export interface NetworkBalanceItem {
  id: string;
  name: string;
  type: 'balance';
  networkName: string; // يو، يمن موبايل، سبأفون، إلخ
  costPrice: number; // Cost ratio (e.g. 0.9700 representing 97% or 3% discount)
  salePrice: number; // Selling multiplier (defaults to 1.00)
  stockQty: number;  // Bulk money amount (e.g. 100,000 YER)
  unit: string;      // 'ريال'
  minLimit: number;  // Warning limit
  createdAt?: string;
}

export default function NetworkRecharge() {
  const { t } = useTranslation();
  const { role, user } = useAuth();
  const { shopSettings, invoices } = useData();
  const { confirm } = useConfirm();

  const [services, setServices] = useState<NetworkBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory'>('sales');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string>('all');

  // Modals / Actions states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<NetworkBalanceItem | null>(null);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [feedService, setFeedService] = useState<NetworkBalanceItem | null>(null);

  // Form Fields for Add/Edit
  const [formName, setFormName] = useState('');
  const [formNetworkName, setFormNetworkName] = useState('يمن موبايل');
  const [formCostPriceRatio, setFormCostPriceRatio] = useState<number>(0.97); // e.g. 0.97
  const [formSalePrice, setFormSalePrice] = useState<number>(1.00);
  const [formStockQty, setFormStockQty] = useState<number>(0); // Total charged bulk amount
  const [formMinLimit, setFormMinLimit] = useState<number>(1000);
  const [saving, setSaving] = useState(false);

  // Form Fields for Feed Stock
  const [feedQty, setFeedQty] = useState<number>(0); // Amount to add to bulk stock
  const [feedCostPriceRatio, setFeedCostPriceRatio] = useState<number>(0);
  const [feeding, setFeeding] = useState(false);

  // Sale Modal state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleService, setSaleService] = useState<NetworkBalanceItem | null>(null);
  const [saleAmount, setSaleAmount] = useState<number>(500); // Amount to sell (e.g. 500 ريال)
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [customerName, setCustomerName] = useState('عميل سفري');
  const [processingSale, setProcessingSale] = useState(false);

  // Print Preview after successful sale
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // List of pre-defined telecom companies in Yemen
  const TELECOM_COMPANIES = ['يمن موبايل', 'يو (YOU)', 'سبأفون', 'واي', 'يمن نت (ADSL)'];

  // Listen to Firestore Services (filtered for type = 'balance')
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'network_services'), orderBy('name', 'asc')),
      (snap) => {
        setLoading(true);
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((item: any) => item.type === 'balance' || item.type === 'recharge') as NetworkBalanceItem[];
        setServices(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Balance list error:", error);
        handleFirestoreError(error, OperationType.LIST, 'network_services');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Set default values when opening add/edit modal
  useEffect(() => {
    if (editingService) {
      setFormName(editingService.name);
      setFormNetworkName(editingService.networkName);
      setFormCostPriceRatio(editingService.costPrice);
      setFormSalePrice(editingService.salePrice || 1.00);
      setFormStockQty(editingService.stockQty);
      setFormMinLimit(editingService.minLimit || 1000);
    } else {
      setFormName('');
      setFormNetworkName('يمن موبايل');
      setFormCostPriceRatio(0.97);
      setFormSalePrice(1.00);
      setFormStockQty(0);
      setFormMinLimit(1000);
    }
  }, [editingService, isModalOpen]);

  // Create or Update Balance Stock (Firestore & Calls PHP Stock Update API)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNetworkName.trim() || formCostPriceRatio <= 0 || formStockQty < 0) {
      notify.info('يرجى ملء جميع الحقول المطلوبة بالشكل الصحيح.');
      return;
    }

    setSaving(true);
    const serviceId = editingService ? editingService.id : `net_bal_${Date.now()}`;
    
    const payload: Omit<NetworkBalanceItem, 'id'> = {
      name: formName.trim(),
      type: 'balance',
      networkName: formNetworkName.trim(),
      costPrice: Number(formCostPriceRatio),
      salePrice: Number(formSalePrice),
      stockQty: Number(formStockQty),
      unit: 'ريال',
      minLimit: Number(formMinLimit)
    };

    try {
      // 1. Save in Firestore
      await setDoc(doc(db, 'network_services', serviceId), payload);

      // 2. Add Activity Log entry
      await addDoc(collection(db, 'activities'), {
        type: 'network_stock',
        description: editingService 
          ? `تحديث بيانات رصيد الاتصالات: ${formName.trim()}`
          : `شحن كتلة رصيد جديدة لـ ${formNetworkName.trim()} بمبلغ أولي ${formStockQty} ريال (التكلفة: ${formCostPriceRatio * 100}%)`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 3. Call PHP Background Endpoint to sync with local MySQL
      try {
        const intId = parseInt(serviceId.replace(/\D/g, '')) || Math.floor(Math.random() * 100000);
        await fetch(getAbsoluteUrl('/php-backend/add_network_stock.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: editingService ? parseInt(editingService.id.replace(/\D/g, '')) || 1 : intId,
            name: formName.trim(),
            type: 'balance',
            network_name: formNetworkName.trim(),
            cost_price: Number(formCostPriceRatio),
            sale_price: Number(formSalePrice),
            quantity: Number(formStockQty),
            unit: 'ريال',
            min_limit: Number(formMinLimit)
          })
        });
      } catch (err) {
        console.warn("Unable to trigger local php-backend stock endpoint:", err);
      }

      notify.success(editingService ? 'تم تعديل بيانات الرصيد بنجاح' : 'تم شحن وتغذية الرصيد بنجاح');
      setIsModalOpen(false);
      setEditingService(null);
    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية الحفظ. الرجاء التحقق من الصلاحيات والشبكة.');
    } finally {
      setSaving(false);
    }
  };

  // Feed/Refill existing stock (Firestore + PHP API)
  const handleFeedStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedService || feedQty <= 0) {
      notify.info('يرجى تحديد كمية الرصيد المشحون بشكل صحيح.');
      return;
    }

    setFeeding(true);
    const newStock = feedService.stockQty + Number(feedQty);
    const updatedCostRatio = feedCostPriceRatio > 0 ? Number(feedCostPriceRatio) : feedService.costPrice;

    try {
      // 1. Update Firestore
      await setDoc(doc(db, 'network_services', feedService.id), {
        ...feedService,
        stockQty: newStock,
        costPrice: updatedCostRatio
      });

      // 2. Add Activity Log
      await addDoc(collection(db, 'activities'), {
        type: 'network_stock_refill',
        description: `تغذية حساب رصيد (${feedService.name}) بمبلغ +${feedQty} ريال يمني. المتوفر الكلي الجديد: ${newStock} ريال`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 3. Call PHP Background Stock API
      try {
        await fetch(getAbsoluteUrl('/php-backend/add_network_stock.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: parseInt(feedService.id.replace(/\D/g, '')) || 1,
            name: feedService.name,
            type: 'balance',
            quantity: Number(feedQty),
            cost_price: updatedCostRatio,
            sale_price: feedService.salePrice,
            unit: 'ريال'
          })
        });
      } catch (err) {
        console.warn("Unable to trigger php stock endpoint:", err);
      }

      notify.success(`تم تغذية حساب الرصيد لـ (${feedService.name}) بنجاح!`);
      setIsFeedModalOpen(false);
      setFeedService(null);
      setFeedQty(0);
      setFeedCostPriceRatio(0);
    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية شحن الرصيد.');
    } finally {
      setFeeding(false);
    }
  };

  // Process Sales Operation (Firestore Deduct + safe/invoice register + Calls PHP Sale API)
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleService) return;

    if (saleAmount <= 0) {
      notify.info('يرجى تحديد مبلغ بيع صحيح.');
      return;
    }

    if (saleService.stockQty < saleAmount) {
      notify.error(`عذراً، الرصيد الإجمالي المتوفر في المخزن غير كافٍ! المتاح حالياً: ${saleService.stockQty.toLocaleString()} ريال.`);
      return;
    }

    if (!beneficiaryPhone.trim()) {
      notify.error('يرجى إدخال رقم هاتف المستفيد لإتمام عملية الشحن.');
      return;
    }

    setProcessingSale(true);
    const unitPrice = saleService.salePrice || 1.00;
    const totalSalesValue = saleAmount * unitPrice;
    
    // Profit = Total Sales Value - (Amount of balance sold * cost ratio)
    const totalCost = saleAmount * saleService.costPrice;
    const profit = totalSalesValue - totalCost;

    let invoiceId = `INV-RECH-${Date.now().toString().substring(6)}`;
    if (shopSettings?.autoIncrementInvoice) {
      const prefix = shopSettings?.invoicePrefix ?? 'INV-';
      const startNum = Number(shopSettings?.invoiceStartNumber ?? 1001);
      
      let maxNum = startNum - 1;
      if (Array.isArray(invoices)) {
        invoices.forEach((inv: any) => {
          const numStr = inv.number || '';
          if (prefix && numStr.startsWith(prefix)) {
            const numericPart = numStr.substring(prefix.length);
            const parsed = parseInt(numericPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        });
      }
      const nextNum = maxNum + 1;
      invoiceId = `${prefix}${String(nextNum).padStart(5, '0')}`;
    }

    try {
      // 1. Deduct stock quantity in Firestore
      await setDoc(doc(db, 'network_services', saleService.id), {
        ...saleService,
        stockQty: saleService.stockQty - saleAmount
      });

      // 2. Insert Invoice Record in Firestore
      const invoicePayload = {
        number: invoiceId,
        customerName: customerName.trim() || 'عميل سفري',
        items: [{
          name: `شحن رصيد مباشر ${saleService.name} للرقم (${beneficiaryPhone.trim()})`,
          quantity: saleAmount,
          price: unitPrice,
          total: totalSalesValue
        }],
        subtotal: totalSalesValue,
        discount: 0,
        tax: 0,
        total: totalSalesValue,
        paymentMethod: 'نقداً',
        date: new Date().toISOString()
      };
      await setDoc(doc(db, 'invoices', invoiceId), invoicePayload);

      // 3. Log user activity
      await addDoc(collection(db, 'activities'), {
        type: 'network_sale',
        description: `شحن رصيد مباشر لـ (${saleService.name}) للرقم (${beneficiaryPhone.trim()}) بمبلغ ${saleAmount} ريال (الربح: ${profit.toFixed(1)} ريال)`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 4. Low Stock warning logging if needed
      const remainingStock = saleService.stockQty - saleAmount;
      if (remainingStock <= saleService.minLimit) {
        await addDoc(collection(db, 'system_alerts'), {
          title: '⚠️ انخفاض كتلة رصيد باقات',
          message: `حساب رصيد الباقات لـ (${saleService.name}) شارف على النفاد! المتبقي بالمخزن حالياً هو: ${remainingStock} ريال.`,
          type: 'warning',
          timestamp: new Date().toISOString(),
          read: false
        });
      }

      // 5. Call PHP Background process
      try {
        await fetch(getAbsoluteUrl('/php-backend/sell_balance.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: parseInt(saleService.id.replace(/\D/g, '')) || 1,
            sale_amount: saleAmount,
            beneficiary_phone: beneficiaryPhone.trim(),
            customer_name: customerName.trim(),
            cashier_name: user?.displayName || 'الكاشير الحسام',
            invoice_id: invoiceId
          })
        });
      } catch (err) {
        console.warn("Unable to sync php recharge API endpoint, continuing standard operation:", err);
      }

      const finalReceipt = {
        invoiceId,
        serviceName: saleService.name,
        type: 'balance',
        networkName: saleService.networkName,
        qty: saleAmount,
        price: unitPrice,
        total: totalSalesValue,
        date: new Date().toISOString(),
        customerName: customerName.trim() || 'عميل سفري',
        beneficiaryPhone: beneficiaryPhone.trim()
      };

      setLastSaleReceipt(finalReceipt);
      setIsSaleModalOpen(false);
      setShowReceiptModal(true);
      notify.success('تمت عملية الشحن المباشر وخصم المخزون بنجاح!');

      // Auto-Print
      await handlePrintVoucher(finalReceipt);

    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية الشحن وتخفيض المخزن الكلي.');
    } finally {
      setProcessingSale(false);
    }
  };

  const handlePrintVoucher = async (receipt: any) => {
    try {
      const storeName = shopSettings?.shopName || 'الحسام فون';
      const details = `\nنوع العملية: شحن وتفعيل مباشر\nرقم المستفيد: ${receipt.beneficiaryPhone}\nرصيد الشحن: ${receipt.qty} ريال`;

      const formattedInvoice = {
        id: receipt.invoiceId,
        number: receipt.invoiceId,
        createdAt: receipt.date,
        customerName: receipt.customerName,
        items: [
          {
            name: `${receipt.serviceName}${details}`,
            quantity: 1,
            price: receipt.total
          }
        ],
        total: receipt.total,
        discount: 0,
        tax: 0,
        paymentMethod: 'نقدًا'
      };

      await BluetoothPrinterService.printInvoice(formattedInvoice, storeName, shopSettings);
      notify.success('تم إرسال إيصال الشحن إلى الطابعة بنجاح.');
    } catch (error: any) {
      console.warn("Print error:", error);
    }
  };

  // Delete Service
  const handleDeleteService = async (service: NetworkBalanceItem) => {
    const isConfirmed = await confirm({
      title: 'حذف رصيد الباقات',
      message: `هل أنت متأكد تماماً من حذف خدمة الرصيد (${service.name})؟ سيتم إزالتها نهائياً.`,
      confirmText: 'نعم، حذف الخدمة',
      cancelText: 'تراجع'
    });

    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'network_services', service.id));
      await addDoc(collection(db, 'activities'), {
        type: 'network_service_deleted',
        description: `حذف خدمة رصيد نهائياً: ${service.name}`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });
      notify.success('تم حذف الخدمة ومخزونها بالكامل.');
    } catch (error) {
      console.error(error);
      notify.error('حدث خطأ أثناء محاولة حذف الخدمة.');
    }
  };

  // Filter Algorithm
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.networkName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNetwork = selectedNetworkFilter === 'all' || service.networkName === selectedNetworkFilter;
    return matchesSearch && matchesNetwork;
  });

  return (
    <div className="space-y-6" dir="rtl" id="network-recharge-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة وتعبئة رصيد الباقات 📲</h1>
            <p className="text-xs text-gray-400 font-bold mt-0.5">شحن وتغذية الرصيد ككتلة مالية مرنة لشركات الاتصالات (يو، يمن موبايل، سبأفون) مع الخصم التلقائي المباشر</p>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
              activeTab === 'sales' 
                ? 'bg-[#541919] text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            شحن رصيد فوري للزبائن
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
              activeTab === 'inventory' 
                ? 'bg-[#541919] text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            إدارة الحسابات وكتل المخزن
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">حسابات الرصيد</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{services.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">إجمالي الرصيد بالمخزن</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {services.reduce((acc, curr) => acc + curr.stockQty, 0).toLocaleString()} {t('ريال')}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">متوسط نسبة التكلفة</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {services.length > 0 
                ? `${(services.reduce((acc, curr) => acc + curr.costPrice, 0) / services.length * 100).toFixed(1)}%`
                : '0%'
              }
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">حسابات منخفضة الرصيد</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {services.filter(s => s.stockQty <= s.minLimit).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ابحث عن شركة، خدمة رصيد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <select
            value={selectedNetworkFilter}
            onChange={(e) => setSelectedNetworkFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-150 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-xs font-bold cursor-pointer focus:outline-none"
          >
            <option value="all">كل الشبكات</option>
            {TELECOM_COMPANIES.map(net => (
              <option key={net} value={net}>{net}</option>
            ))}
          </select>

          {activeTab === 'inventory' && (role === 'admin' || role === 'manager') && (
            <button
              onClick={() => {
                setEditingService(null);
                setIsModalOpen(true);
              }}
              className="bg-[#541919] hover:bg-[#541919]/90 text-white px-4 py-2.5 rounded-xl text-xs font-black border-none flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-4.5 h-4.5" />
              شحن كتلة رصيد جديدة
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-bold">جاري تحميل حسابات الرصيد والباقات...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs animate-fade-in">
          <Smartphone className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <h3 className="text-base font-black text-gray-700 dark:text-gray-300">لا توجد خدمات رصيد مسجلة</h3>
          <p className="text-xs text-gray-400 font-bold mt-1 max-w-md mx-auto">
            قم بالدخول إلى تبويب "إدارة الحسابات وكتل المخزن" لإضافة كتل شحن رصيد لشركات الاتصالات (يو، يمن موبايل، إلخ).
          </p>
        </div>
      ) : activeTab === 'sales' ? (
        /* SALES VIEW (CARDS OF BALANCES) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredServices.map(service => {
            const isLow = service.stockQty <= service.minLimit;
            const isOut = service.stockQty <= 0;

            return (
              <motion.div
                key={service.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                  isOut 
                    ? 'border-red-200 dark:border-red-950/40 opacity-70' 
                    : isLow 
                      ? 'border-amber-200 dark:border-amber-950/40 animate-pulse-subtle' 
                      : 'border-gray-100 dark:border-slate-800'
                } p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all relative overflow-hidden`}
              >
                <span className="absolute -top-3 -left-3 text-7xl font-black text-gray-100/30 dark:text-slate-800/10 pointer-events-none select-none z-0">
                  GSM
                </span>

                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      رصيد باقات مرن
                    </span>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                      isOut 
                        ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' 
                        : isLow 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' 
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/10 dark:text-emerald-400'
                    }`}>
                      {isOut ? 'نافد' : `المتبقي: ${service.stockQty.toLocaleString()} ريال`}
                    </span>
                  </div>

                  <div className="pt-2 text-right">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{service.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">شركة الاتصالات: {service.networkName}</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold">نسبة التكلفة من الوكيل:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{(service.costPrice * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="pt-4 relative z-10">
                  <button
                    onClick={() => {
                      setSaleService(service);
                      setSaleAmount(500);
                      setBeneficiaryPhone('');
                      setCustomerName('عميل سفري');
                      setIsSaleModalOpen(true);
                    }}
                    disabled={isOut}
                    className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all border-none flex items-center justify-center gap-1.5 cursor-pointer ${
                      isOut 
                        ? 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    شحن رصيد مباشر للعميل
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* INVENTORY VIEW (TABLE) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs font-black border-b border-gray-100 dark:border-slate-700">
                  <th className="p-4">اسم شركة الاتصالات / الحساب</th>
                  <th className="p-4">الشركة الموفرة</th>
                  <th className="p-4">نسبة التكلفة للرصيد (الشراء)</th>
                  <th className="p-4">سعر بيع الريال للزبون</th>
                  <th className="p-4">إجمالي الرصيد المتوفر بالمخزن</th>
                  <th className="p-4">الربح الصافي المتوقع لكل (1,000 ريال)</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-gray-700 dark:text-gray-300">
                {filteredServices.map(service => {
                  const isLow = service.stockQty <= service.minLimit;
                  const isOut = service.stockQty <= 0;
                  
                  // Expected profit per 1000 YER balance sold:
                  // profit = 1000 * (salePrice - costPrice)
                  const profitPer1000 = 1000 * (service.salePrice - service.costPrice);

                  return (
                    <tr key={service.id} className="hover:bg-gray-50/55 dark:hover:bg-slate-850/40 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${isLow ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} flex items-center justify-center font-black text-xs shrink-0`}>
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-gray-950 dark:text-white block">{service.name}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">ID: {service.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">{service.networkName}</td>
                      <td className="p-4 text-emerald-600 font-extrabold font-mono">{(service.costPrice * 100).toFixed(2)}%</td>
                      <td className="p-4 font-extrabold font-mono">{service.salePrice.toFixed(2)} ريال لكل ريال</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black ${
                          isOut 
                            ? 'bg-red-100 text-red-600 dark:bg-red-950/20' 
                            : isLow 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20' 
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20'
                        }`}>
                          {service.stockQty.toLocaleString()} ريال
                        </span>
                      </td>
                      <td className="p-4 text-emerald-600 font-extrabold">+{profitPer1000.toLocaleString()} ريال</td>
                      <td className="p-4 text-left">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setFeedService(service);
                              setFeedQty(0);
                              setFeedCostPriceRatio(service.costPrice);
                              setIsFeedModalOpen(true);
                            }}
                            title="تغذية/شحن الرصيد في المخزن"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border-none cursor-pointer transition-all"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                          {(role === 'admin' || role === 'manager') && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingService(service);
                                  setIsModalOpen(true);
                                }}
                                title="تعديل حساب الرصيد"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border-none cursor-pointer transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteService(service)}
                                title="حذف"
                                className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-500 rounded-lg border-none cursor-pointer transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT ACCOUNT */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right"
              dir="rtl"
            >
              <div className="bg-[#541919] p-4 text-white flex justify-between items-center">
                <h3 className="font-black text-sm">{editingService ? 'تعديل حساب رصيد الباقات 📲' : 'شحن وتغذية رصيد جديد بالمستودع ➕'}</h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveService} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">اسم حساب الرصيد *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: رصيد يمن موبايل مباشر"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Telecom Company Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">اسم شركة الاتصالات الموفرة *</label>
                    <select
                      value={formNetworkName}
                      onChange={(e) => setFormNetworkName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      {TELECOM_COMPANIES.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bulk stock Qty */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">إجمالي رصيد الاتصالات المشحون ككتلة كاملة *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="مثل: 100,000 ريال يمني"
                      value={formStockQty}
                      onChange={(e) => setFormStockQty(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Cost Price Ratio */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">نسبة تكلفة شراء الرصيد من الموزع (مثلاً 0.97 لشحن 3%) *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      max="1.5"
                      placeholder="مثل: 0.9700"
                      value={formCostPriceRatio}
                      onChange={(e) => setFormCostPriceRatio(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sale price multiplier */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">سعر بيع الريال للزبون *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      placeholder="الافتراضي 1.00 ريال لكل ريال"
                      value={formSalePrice}
                      onChange={(e) => setFormSalePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Min Limit */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">حد التنبيه عند اقتراب نفاد كتلة الرصيد</label>
                    <input
                      type="number"
                      required
                      min="100"
                      value={formMinLimit}
                      onChange={(e) => setFormMinLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="bg-[#541919]/5 p-3 rounded-xl text-xs space-y-1 border border-dashed border-[#541919]/20">
                  <p className="font-bold text-[#541919]">💡 توضيح الآلية الحسابية:</p>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    إذا شحنت رصيد بمبلغ <span className="font-bold">100,000</span> ريال وكانت نسبة تكلفة الشراء <span className="font-bold">0.9700 (أي خصم 3%)</span>، فهذا يعني أنك دفعت فعلياً <span className="font-bold">97,000</span> ريال للوكيل الموزع، وسوف تجني أرباحاً صافية قدرها <span className="font-bold">3,000</span> ريال يمني عند اكتمال بيع كامل كتلة الرصيد للزبائن.
                  </p>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#541919] hover:bg-[#541919]/90 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    {saving ? 'جاري التسجيل والربط...' : 'حفظ وتحديث كتل الرصيد'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: FEED STOCK (RECHARGE REFILL) */}
      <AnimatePresence>
        {isFeedModalOpen && feedService && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right"
              dir="rtl"
            >
              <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-black text-sm">تغذية وشحن رصيد إضافي 📥</h3>
                <button 
                  onClick={() => setIsFeedModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFeedStock} className="p-5 space-y-4">
                <div className="bg-emerald-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-bold">تغذية الصنف: <span className="font-black">{feedService.name}</span></p>
                  <p className="mt-1 font-semibold">إجمالي الرصيد المتوفر حالياً: <span className="font-black">{feedService.stockQty.toLocaleString()} ريال</span></p>
                </div>

                {/* Feed Qty */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">مبلغ الرصيد المشحون المضاف للكتلة الكلية (بالريال اليمني) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    placeholder="مثال: 50,000"
                    value={feedQty || ''}
                    onChange={(e) => setFeedQty(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Cost Price Ratio */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">نسبة تكلفة الشراء المحدثة (الافتراضي: {feedService.costPrice})</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="1.5"
                    value={feedCostPriceRatio || feedService.costPrice}
                    onChange={(e) => setFeedCostPriceRatio(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={feeding}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    {feeding ? 'جاري شحن وتغذية الرصيد...' : 'شحن الكتلة المحددة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFeedModalOpen(false)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: DIRECT CLIENT RECHARGE SALE */}
      <AnimatePresence>
        {isSaleModalOpen && saleService && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right"
              dir="rtl"
            >
              <div className="bg-[#541919] p-4 text-white flex justify-between items-center">
                <h3 className="font-black text-sm">شحن رصيد وباقات مباشر 📲</h3>
                <button 
                  onClick={() => setIsSaleModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleProcessSale} className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-[#541919]/5 border border-dashed border-[#541919]/10 text-xs text-right">
                  <p className="font-black text-slate-800 dark:text-slate-200">{saleService.name}</p>
                  <p className="text-gray-400 mt-1 font-bold">الشركة الموفرة: {saleService.networkName}</p>
                  <p className="text-gray-400 font-bold">الرصيد الكلي المتاح حالياً بالفرع: <span className="font-black text-primary">{saleService.stockQty.toLocaleString()} ريال</span></p>
                </div>

                {/* Beneficiary Phone */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold flex items-center gap-1 justify-start">
                    <PhoneCall className="w-3 h-3 text-[#B3803E]" /> رقم هاتف المستفيد لشحن الرصيد *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="مثل: 777123456"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary text-left"
                    dir="ltr"
                  />
                </div>

                {/* Sale Amount */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">مبلغ البيع المراد شحنه للزبون *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={saleService.stockQty}
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Customer Name */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">اسم العميل (اختياري)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Pricing summary */}
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl space-y-2 text-xs font-bold border border-gray-150 dark:border-slate-800 text-right">
                  <div className="flex justify-between text-gray-400">
                    <span>مبلغ الشحن المطلوب:</span>
                    <span>{saleAmount.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>سعر البيع:</span>
                    <span>1.00 ريال لكل ريال</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 border-t border-dashed border-gray-200 dark:border-slate-700 pt-1.5 font-black text-sm">
                    <span>المبلغ المطلوب دفعه نقداً:</span>
                    <span>{saleAmount.toLocaleString()} YER</span>
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={processingSale}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    {processingSale ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                    {processingSale ? 'جاري شحن وتفعيل الباقة...' : 'تأكيد عملية الشحن الفوري'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSaleModalOpen(false)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VOUCHER / RECEIPT PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showReceiptModal && lastSaleReceipt && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right font-sans"
              dir="rtl"
            >
              <div className="bg-[#B3803E] p-4 text-white flex justify-between items-center">
                <span className="font-black text-xs">سند شحن رصيد وباقة مباشر 🖨️</span>
                <button 
                  onClick={() => {
                    setShowReceiptModal(false);
                    setLastSaleReceipt(null);
                  }}
                  className="text-white hover:text-white/80 bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-base font-black text-slate-800 dark:text-white">{shopSettings?.shopName || 'الحسام فون'}</h2>
                  <p className="text-[10px] text-gray-400 font-bold">برمجة: مازن فارع | 776591639</p>
                  <p className="text-[9px] text-gray-400 font-semibold font-mono">{lastSaleReceipt.date.replace('T', ' ').substring(0, 19)}</p>
                </div>

                <div className="border-t border-b border-dashed border-gray-200 dark:border-slate-800 py-3 space-y-2 text-xs font-bold text-gray-600 dark:text-gray-300 text-right">
                  <div className="flex justify-between">
                    <span>رقم العملية:</span>
                    <span className="font-mono text-slate-900 dark:text-white font-black">{lastSaleReceipt.invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <span>{lastSaleReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الشركة الموفرة:</span>
                    <span>{lastSaleReceipt.networkName}</span>
                  </div>
                  <div className="flex justify-between text-[#B3803E] font-black">
                    <span>رقم المستفيد:</span>
                    <span className="font-mono">{lastSaleReceipt.beneficiaryPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مبلغ الشحن المباشر:</span>
                    <span>{lastSaleReceipt.qty.toLocaleString()} ريال</span>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-slate-850 p-4 rounded-xl text-center border border-dashed border-emerald-500/30">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black block mb-1">حالة العملية</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                    ✓ تم الشحن والتفعيل المباشر بنجاح
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 text-sm">
                  <span className="font-black text-slate-800 dark:text-white">المبلغ الكلي المدفوع:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{lastSaleReceipt.total.toLocaleString()} ريال</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintVoucher(lastSaleReceipt)}
                    className="flex-1 bg-secondary hover:bg-secondary/95 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة إيصال الشحن
                  </button>
                  <button
                    onClick={() => {
                      setShowReceiptModal(false);
                      setLastSaleReceipt(null);
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
