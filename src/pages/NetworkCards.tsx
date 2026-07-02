import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Plus, 
  Printer, 
  Search, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Database, 
  AlertTriangle, 
  Layers, 
  Ticket, 
  Coins, 
  User, 
  PlusCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useTranslation } from '../lib/translations';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { BluetoothPrinterService } from '../lib/bluetoothPrinter';
import { useConfirm } from '../lib/ConfirmContext';

export interface NetworkCardItem {
  id: string;
  name: string;
  type: 'cards';
  networkName: string;
  costPrice: number; // Cost of buying 1 card
  salePrice: number; // Selling price of 1 card
  stockQty: number;  // Available card count
  unit: string;      // 'كرت'
  minLimit: number;
  denomination: number; // 100, 250, 500, etc.
  createdAt?: string;
}

export default function NetworkCards() {
  const { t } = useTranslation();
  const { role, user } = useAuth();
  const { shopSettings, invoices } = useData();
  const { confirm } = useConfirm();

  const [cards, setCards] = useState<NetworkCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory'>('sales');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string>('all');

  // Modals / Actions states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<NetworkCardItem | null>(null);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [feedCard, setFeedCard] = useState<NetworkCardItem | null>(null);

  // Form Fields for Add/Edit
  const [formName, setFormName] = useState('');
  const [formNetworkName, setFormNetworkName] = useState('');
  const [formDenomination, setFormDenomination] = useState<number>(100);
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formStockQty, setFormStockQty] = useState<number>(0);
  const [formMinLimit, setFormMinLimit] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  // Form Fields for Feed Stock
  const [feedQty, setFeedQty] = useState<number>(0);
  const [feedCostPrice, setFeedCostPrice] = useState<number>(0);
  const [feedSalePrice, setFeedSalePrice] = useState<number>(0);
  const [feeding, setFeeding] = useState(false);

  // Sale Modal state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleCard, setSaleCard] = useState<NetworkCardItem | null>(null);
  const [saleQty, setSaleQty] = useState<number>(1);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [customerName, setCustomerName] = useState('عميل سفري');
  const [processingSale, setProcessingSale] = useState(false);

  // Print Preview after successful sale
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Get unique network names list for filter
  const networksList = Array.from(new Set(cards.map(c => c.networkName).filter(Boolean)));

  // Listen to Firestore Services (filtered for type = 'cards')
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'network_services'), orderBy('name', 'asc')),
      (snap) => {
        setLoading(true);
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((item: any) => item.type === 'cards' || item.type === 'card') as NetworkCardItem[];
        setCards(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Network cards list error:", error);
        handleFirestoreError(error, OperationType.LIST, 'network_services');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Set default values when opening add/edit modal
  useEffect(() => {
    if (editingCard) {
      setFormName(editingCard.name);
      setFormNetworkName(editingCard.networkName);
      setFormDenomination(editingCard.denomination || 100);
      setFormCostPrice(editingCard.costPrice);
      setFormSalePrice(editingCard.salePrice);
      setFormStockQty(editingCard.stockQty);
      setFormMinLimit(editingCard.minLimit);
    } else {
      setFormName('');
      setFormNetworkName('');
      setFormDenomination(100);
      setFormCostPrice(0);
      setFormSalePrice(0);
      setFormStockQty(0);
      setFormMinLimit(5);
    }
  }, [editingCard, isModalOpen]);

  // Create or Update Card (Firestore & PHP Stock Update API)
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNetworkName.trim() || formDenomination <= 0 || formSalePrice <= 0) {
      notify.info('يرجى ملء جميع الحقول المطلوبة بالشكل الصحيح.');
      return;
    }

    setSaving(true);
    const cardId = editingCard ? editingCard.id : `net_card_${Date.now()}`;
    
    const payload: Omit<NetworkCardItem, 'id'> = {
      name: formName.trim(),
      type: 'cards',
      networkName: formNetworkName.trim(),
      costPrice: Number(formCostPrice),
      salePrice: Number(formSalePrice),
      stockQty: Number(formStockQty),
      unit: 'كرت',
      minLimit: Number(formMinLimit),
      denomination: Number(formDenomination)
    };

    try {
      // 1. Save in Firestore
      await setDoc(doc(db, 'network_services', cardId), payload);

      // 2. Add Activity Log entry
      await addDoc(collection(db, 'activities'), {
        type: 'network_stock',
        description: editingCard 
          ? `تحديث بيانات كرت الشبكة: ${formName.trim()} (فئة ${formDenomination})`
          : `إضافة كرت شبكة جديد: ${formName.trim()} بمتوفر أولي ${formStockQty} كرت (التكلفة: ${formCostPrice}، البيع: ${formSalePrice})`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 3. Call PHP Background Endpoint
      try {
        const intId = parseInt(cardId.replace(/\D/g, '')) || Math.floor(Math.random() * 100000);
        await fetch('/php-backend/add_network_stock.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: editingCard ? parseInt(editingCard.id.replace(/\D/g, '')) || 1 : intId,
            name: formName.trim(),
            type: 'cards',
            network_name: formNetworkName.trim(),
            denomination: Number(formDenomination),
            cost_price: Number(formCostPrice),
            sale_price: Number(formSalePrice),
            quantity: Number(formStockQty),
            unit: 'كرت',
            min_limit: Number(formMinLimit)
          })
        });
      } catch (err) {
        console.warn("Unable to trigger local php-backend endpoint:", err);
      }

      notify.success(editingCard ? 'تم تعديل كرت الشبكة بنجاح' : 'تم إضافة كرت الشبكة بنجاح');
      setIsModalOpen(false);
      setEditingCard(null);
    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية الحفظ. الرجاء التحقق من الصلاحيات والشبكة.');
    } finally {
      setSaving(false);
    }
  };

  // Feed/Refill existing stock
  const handleFeedStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedCard || feedQty <= 0) {
      notify.info('يرجى تحديد كمية التغذية بشكل صحيح.');
      return;
    }

    setFeeding(true);
    const newStock = feedCard.stockQty + Number(feedQty);
    const updatedCost = feedCostPrice > 0 ? Number(feedCostPrice) : feedCard.costPrice;
    const updatedSale = feedSalePrice > 0 ? Number(feedSalePrice) : feedCard.salePrice;

    try {
      // 1. Update Firestore
      await setDoc(doc(db, 'network_services', feedCard.id), {
        ...feedCard,
        stockQty: newStock,
        costPrice: updatedCost,
        salePrice: updatedSale
      });

      // 2. Add Activity Log
      await addDoc(collection(db, 'activities'), {
        type: 'network_stock_refill',
        description: `تغذية مخزون كروت الشبكة (${feedCard.name}) بمقدار +${feedQty} كرت. الإجمالي الجديد: ${newStock}`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 3. Call PHP Background Stock API
      try {
        await fetch('/php-backend/add_network_stock.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: parseInt(feedCard.id.replace(/\D/g, '')) || 1,
            name: feedCard.name,
            type: 'cards',
            denomination: feedCard.denomination,
            quantity: Number(feedQty),
            cost_price: updatedCost,
            sale_price: updatedSale,
            unit: 'كرت'
          })
        });
      } catch (err) {
        console.warn("Unable to trigger php stock endpoint:", err);
      }

      notify.success(`تم تغذية مخزون (${feedCard.name}) بنجاح!`);
      setIsFeedModalOpen(false);
      setFeedCard(null);
      setFeedQty(0);
      setFeedCostPrice(0);
      setFeedSalePrice(0);
    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية تغذية المخزون.');
    } finally {
      setFeeding(false);
    }
  };

  // Process Sales Operation
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCard) return;

    if (saleQty <= 0) {
      notify.info('يرجى تحديد كمية بيع صحيحة.');
      return;
    }

    if (saleCard.stockQty < saleQty) {
      notify.error(`عذراً، الكروت المتوفرة غير كافية! المتاح حالياً: ${saleCard.stockQty} كرت.`);
      return;
    }

    setProcessingSale(true);
    const unitPrice = salePrice > 0 ? Number(salePrice) : saleCard.salePrice;
    const totalAmount = unitPrice * saleQty;
    const profit = (unitPrice - saleCard.costPrice) * saleQty;

    let invoiceId = `INV-CARD-${Date.now().toString().substring(6)}`;
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
      await setDoc(doc(db, 'network_services', saleCard.id), {
        ...saleCard,
        stockQty: saleCard.stockQty - saleQty
      });

      // 2. Insert Invoice Record in Firestore
      const invoicePayload = {
        number: invoiceId,
        customerName: customerName.trim() || 'عميل سفري',
        items: [{
          name: `${saleCard.name} (كروت شبكة فئة ${saleCard.denomination})`,
          quantity: saleQty,
          price: unitPrice,
          total: totalAmount
        }],
        subtotal: totalAmount,
        discount: 0,
        tax: 0,
        total: totalAmount,
        paymentMethod: 'نقداً',
        date: new Date().toISOString()
      };
      await setDoc(doc(db, 'invoices', invoiceId), invoicePayload);

      // 3. Log user activity
      await addDoc(collection(db, 'activities'), {
        type: 'network_sale',
        description: `بيع كروت شبكة (${saleCard.name}) للعميل (${customerName}) بقيمة ${totalAmount} ريال (الربح: ${profit.toFixed(1)} ريال)`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });

      // 4. Low Stock warning logging if needed
      const remainingStock = saleCard.stockQty - saleQty;
      if (remainingStock <= saleCard.minLimit) {
        await addDoc(collection(db, 'system_alerts'), {
          title: '⚠️ انخفاض مخزون كروت شبكة',
          message: `الكروت للصنف (${saleCard.name}) شارفت على النفاد! المتبقي هو: ${remainingStock} كرت.`,
          type: 'warning',
          timestamp: new Date().toISOString(),
          read: false
        });
      }

      // 5. Call PHP Background process
      let generatedPin = String(Math.floor(100000000000 + Math.random() * 899999999999));
      try {
        const response = await fetch('/php-backend/sell_network_service.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: parseInt(saleCard.id.replace(/\D/g, '')) || 1,
            qty: saleQty,
            denomination: saleCard.denomination,
            price: totalAmount,
            customer_name: customerName.trim(),
            cashier_name: user?.displayName || 'الكاشير الحسام',
            invoice_id: invoiceId
          })
        });
        const resData = await response.json();
        if (resData.print_payload && resData.print_payload.card_pin) {
          generatedPin = resData.print_payload.card_pin;
        }
      } catch (err) {
        console.warn("Unable to sync php sale API endpoint, continuing standard operation:", err);
      }

      const finalReceipt = {
        invoiceId,
        serviceName: saleCard.name,
        type: 'cards',
        networkName: saleCard.networkName,
        qty: saleQty,
        price: unitPrice,
        total: totalAmount,
        date: new Date().toISOString(),
        customerName: customerName.trim() || 'عميل سفري',
        pin: generatedPin
      };

      setLastSaleReceipt(finalReceipt);
      setIsSaleModalOpen(false);
      setShowReceiptModal(true);
      notify.success('تمت عملية بيع الكروت بنجاح!');

      // Auto-Print
      await handlePrintVoucher(finalReceipt);

    } catch (error) {
      console.error(error);
      notify.error('فشلت عملية البيع.');
    } finally {
      setProcessingSale(false);
    }
  };

  const handlePrintVoucher = async (receipt: any) => {
    try {
      const storeName = shopSettings?.shopName || 'الحسام فون';
      const pinText = `\n================================\n  الرمـز الســري (PIN):\n  ${receipt.pin}\n================================`;

      const formattedInvoice = {
        id: receipt.invoiceId,
        number: receipt.invoiceId,
        createdAt: receipt.date,
        customerName: receipt.customerName,
        items: [
          {
            name: `${receipt.serviceName}${pinText}`,
            quantity: receipt.qty,
            price: receipt.price
          }
        ],
        total: receipt.total,
        discount: 0,
        tax: 0,
        paymentMethod: 'نقدًا'
      };

      await BluetoothPrinterService.printInvoice(formattedInvoice, storeName, shopSettings);
      notify.success('تم إرسال الكرت إلى الطابعة بنجاح.');
    } catch (error: any) {
      console.warn("Print error:", error);
    }
  };

  // Delete Card
  const handleDeleteCard = async (card: NetworkCardItem) => {
    const isConfirmed = await confirm({
      title: 'حذف صنف الكروت',
      message: `هل أنت متأكد تماماً من حذف الكرت (${card.name})؟ سيتم إزالته نهائياً من مخزن الكروت.`,
      confirmText: 'نعم، حذف',
      cancelText: 'تراجع'
    });

    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'network_services', card.id));
      await addDoc(collection(db, 'activities'), {
        type: 'network_service_deleted',
        description: `حذف كرت شبكة نهائياً: ${card.name} فئة ${card.denomination}`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'مجهول'
      });
      notify.success('تم حذف الكرت بنجاح.');
    } catch (error) {
      console.error(error);
      notify.error('حدث خطأ أثناء محاولة الحذف.');
    }
  };

  // Filter Algorithm
  const filteredCards = cards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          card.networkName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNetwork = selectedNetworkFilter === 'all' || card.networkName === selectedNetworkFilter;
    return matchesSearch && matchesNetwork;
  });

  return (
    <div className="space-y-6" dir="rtl" id="network-cards-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Ticket className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة ومبيعات كروت الشبكة 🎫</h1>
            <p className="text-xs text-gray-400 font-bold mt-0.5">بيع وإدارة كروت الشبكات المحلية والواي فاي فئة (100، 250، 500) وحساب الأرباح الفورية</p>
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
            <Ticket className="w-4 h-4" />
            منصة البيع الفوري
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
            جرد وتغذية المخزون
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">أنواع الكروت</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{cards.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">إجمالي كروت المخزن</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {cards.reduce((acc, curr) => acc + curr.stockQty, 0)} {t('كرت')}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">القيمة الإجمالية للبيع</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {cards.reduce((acc, curr) => acc + (curr.stockQty * curr.salePrice), 0).toLocaleString()} <span className="text-xs">YER</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block">كروت قاربت على النفاد</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">
              {cards.filter(c => c.stockQty <= c.minLimit).length}
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
              placeholder="ابحث عن كرت، اسم الشبكة المحلية..."
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
            {networksList.map(net => (
              <option key={net} value={net}>{net}</option>
            ))}
          </select>

          {activeTab === 'inventory' && (role === 'admin' || role === 'manager') && (
            <button
              onClick={() => {
                setEditingCard(null);
                setIsModalOpen(true);
              }}
              className="bg-[#541919] hover:bg-[#541919]/90 text-white px-4 py-2.5 rounded-xl text-xs font-black border-none flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-4.5 h-4.5" />
              إضافة كروت جديدة
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-bold">جاري تحميل كروت الشبكة...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs animate-fade-in">
          <Ticket className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <h3 className="text-base font-black text-gray-700 dark:text-gray-300">لا توجد كروت شبكة مسجلة</h3>
          <p className="text-xs text-gray-400 font-bold mt-1 max-w-md mx-auto">
            قم بالدخول إلى تبويب "جرد وتغذية المخزون" لإضافة كروت جديدة للمخزن لتظهر هنا في منصة البيع المباشر.
          </p>
        </div>
      ) : activeTab === 'sales' ? (
        /* SALES VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map(card => {
            const isLow = card.stockQty <= card.minLimit;
            const isOut = card.stockQty <= 0;

            return (
              <motion.div
                key={card.id}
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
                  {card.denomination}
                </span>

                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      فئة {card.denomination} ريال
                    </span>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                      isOut 
                        ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' 
                        : isLow 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' 
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/10 dark:text-emerald-400'
                    }`}>
                      {isOut ? 'نافد' : `المتبقي: ${card.stockQty} كرت`}
                    </span>
                  </div>

                  <div className="pt-2 text-right">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{card.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">الشبكة: {card.networkName}</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold">سعر البيع للزبون:</span>
                    <span className="font-extrabold text-primary">{card.salePrice.toLocaleString()} ريال</span>
                  </div>
                </div>

                <div className="pt-4 relative z-10">
                  <button
                    onClick={() => {
                      setSaleCard(card);
                      setSaleQty(1);
                      setSalePrice(card.salePrice);
                      setCustomerName('عميل سفري');
                      setIsSaleModalOpen(true);
                    }}
                    disabled={isOut}
                    className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all border-none flex items-center justify-center gap-1.5 cursor-pointer ${
                      isOut 
                        ? 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' 
                        : 'bg-[#541919] hover:bg-[#541919]/90 text-white shadow-xs'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    بيع كرت فوري
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
                  <th className="p-4">اسم الكرت بالمخازن</th>
                  <th className="p-4">الشبكة المحلية</th>
                  <th className="p-4">الفئة المحددة</th>
                  <th className="p-4">سعر شراء الكرت (التكلفة)</th>
                  <th className="p-4">سعر بيع الكرت للزبون</th>
                  <th className="p-4">الكمية المتوفرة بالمخزن</th>
                  <th className="p-4">الربح المتوقع لكل كرت</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-gray-700 dark:text-gray-300">
                {filteredCards.map(card => {
                  const isLow = card.stockQty <= card.minLimit;
                  const isOut = card.stockQty <= 0;
                  const cardProfit = card.salePrice - card.costPrice;

                  return (
                    <tr key={card.id} className="hover:bg-gray-50/55 dark:hover:bg-slate-850/40 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${isLow ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'} flex items-center justify-center font-black text-xs shrink-0`}>
                            {card.denomination}
                          </div>
                          <div>
                            <span className="font-extrabold text-gray-950 dark:text-white block">{card.name}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">ID: {card.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">{card.networkName}</td>
                      <td className="p-4">
                        <span className="bg-amber-50 dark:bg-slate-850 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-md text-[10px] font-black">
                          {card.denomination} ريال
                        </span>
                      </td>
                      <td className="p-4 text-amber-600 font-extrabold">{card.costPrice.toLocaleString()} ريال</td>
                      <td className="p-4 text-primary font-extrabold">{card.salePrice.toLocaleString()} ريال</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black ${
                          isOut 
                            ? 'bg-red-100 text-red-600 dark:bg-red-950/20' 
                            : isLow 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20' 
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20'
                        }`}>
                          {card.stockQty} كرت
                        </span>
                      </td>
                      <td className="p-4 text-emerald-600 font-extrabold">+{cardProfit.toLocaleString()} ريال</td>
                      <td className="p-4 text-left">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setFeedCard(card);
                              setFeedQty(0);
                              setFeedCostPrice(card.costPrice);
                              setFeedSalePrice(card.salePrice);
                              setIsFeedModalOpen(true);
                            }}
                            title="تغذية مخزون الكروت"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border-none cursor-pointer transition-all"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                          {(role === 'admin' || role === 'manager') && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingCard(card);
                                  setIsModalOpen(true);
                                }}
                                title="تعديل الكرت"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border-none cursor-pointer transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCard(card)}
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

      {/* MODAL 1: ADD / EDIT CARD */}
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
                <h3 className="font-black text-sm">{editingCard ? 'تعديل كرت الشبكة 🎫' : 'إضافة كروت شبكة جديدة ➕'}</h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCard} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">اسم الشبكة/الكرت *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: المجد فئة 100"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* NetworkName */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">اسم الشركة/الشبكة الموفرة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: المجد، الإمبراطور"
                      value={formNetworkName}
                      onChange={(e) => setFormNetworkName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Denomination */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">الفئة المحددة (القيمة الإسمية) *</label>
                    <select
                      value={formDenomination}
                      onChange={(e) => setFormDenomination(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="100">100 ريال</option>
                      <option value="250">250 ريال</option>
                      <option value="500">500 ريال</option>
                      <option value="1000">1000 ريال</option>
                    </select>
                  </div>

                  {/* Initial Stock Qty */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">عدد الكروت المضافة للمخزن *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formStockQty}
                      onChange={(e) => setFormStockQty(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CostPrice */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">سعر شراء الكرت الواحد (التكلفة) *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      placeholder="التكلفة الفعلية للكرت"
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* SalePrice */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">سعر بيع الكرت للزبون *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      placeholder="سعر البيع النهائي"
                      value={formSalePrice}
                      onChange={(e) => setFormSalePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Min Limit */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">حد الأمان والتنبيه عند انخفاض المخزون</label>
                  <input
                    type="number"
                    min="1"
                    value={formMinLimit}
                    onChange={(e) => setFormMinLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-secondary hover:bg-secondary/90 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    {saving ? 'جاري الحفظ والربط...' : 'حفظ كرت الشبكة'}
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

      {/* MODAL 2: FEED STOCK */}
      <AnimatePresence>
        {isFeedModalOpen && feedCard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right"
              dir="rtl"
            >
              <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-black text-sm">تغذية مخزون الكروت 📥</h3>
                <button 
                  onClick={() => setIsFeedModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFeedStock} className="p-5 space-y-4">
                <div className="bg-emerald-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-bold">تغذية الصنف: <span className="font-black">{feedCard.name}</span></p>
                  <p className="mt-1 font-semibold">المخزون الحالي المتوفر: <span className="font-black">{feedCard.stockQty} كرت</span></p>
                </div>

                {/* Feed Qty */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">عدد الكروت المضافة للمخزن حالياً *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={feedQty || ''}
                    onChange={(e) => setFeedQty(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* CostPrice */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">سعر الشراء الجديد (الكرت)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={feedCostPrice}
                      onChange={(e) => setFeedCostPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* SalePrice */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">سعر البيع الجديد (الكرت)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={feedSalePrice}
                      onChange={(e) => setFeedSalePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={feeding}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all"
                  >
                    {feeding ? 'جاري التغذية والربط...' : 'إضافة الكمية للمخزن'}
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

      {/* MODAL 3: PROCESS SALE */}
      <AnimatePresence>
        {isSaleModalOpen && saleCard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 text-right"
              dir="rtl"
            >
              <div className="bg-[#541919] p-4 text-white flex justify-between items-center">
                <h3 className="font-black text-sm">بيع كروت فوري 💳</h3>
                <button 
                  onClick={() => setIsSaleModalOpen(false)} 
                  className="text-white/80 hover:text-white bg-transparent border-none text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleProcessSale} className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-[#541919]/5 border border-dashed border-[#541919]/10 text-xs">
                  <p className="font-black text-slate-800 dark:text-slate-200">{saleCard.name}</p>
                  <p className="text-gray-400 mt-1 font-bold">الفئة الإسمية للكرت: {saleCard.denomination} ريال</p>
                  <p className="text-gray-400 font-bold">الكمية المتوفرة بالمخزن: {saleCard.stockQty} كرت</p>
                </div>

                {/* Qty */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">عدد الكروت المطلوبة للبيع *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={saleCard.stockQty}
                    value={saleQty}
                    onChange={(e) => setSaleQty(Number(e.target.value))}
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
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl space-y-2 text-xs font-bold border border-gray-150 dark:border-slate-800">
                  <div className="flex justify-between text-gray-400">
                    <span>سعر الكرت للزبون:</span>
                    <span>{saleCard.salePrice.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between text-gray-400 border-b border-dashed border-gray-200 dark:border-slate-700 pb-1.5">
                    <span>الكمية:</span>
                    <span>{saleQty} كرت</span>
                  </div>
                  <div className="flex justify-between text-primary font-black text-sm">
                    <span>إجمالي القيمة:</span>
                    <span>{(saleCard.salePrice * saleQty).toLocaleString()} ريال يمني</span>
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={processingSale}
                    className="flex-1 bg-[#541919] hover:bg-[#541919]/95 text-white font-black py-2.5 rounded-xl text-xs border-none cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    {processingSale ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    {processingSale ? 'جاري تفعيل وطباعة الكرت...' : 'بيع وتفليش الكرت فورا'}
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
                <span className="font-black text-xs">سند استلام كرت شبكة فوري 🖨️</span>
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
                  <p className="text-[10px] text-gray-400 font-bold">تلفون المبرمج: 776591639 | مازن فارع</p>
                  <p className="text-[9px] text-gray-400 font-semibold font-mono">{lastSaleReceipt.date.replace('T', ' ').substring(0, 19)}</p>
                </div>

                <div className="border-t border-b border-dashed border-gray-200 dark:border-slate-800 py-3 space-y-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>رقم الفاتورة:</span>
                    <span className="font-mono text-slate-900 dark:text-white font-black">{lastSaleReceipt.invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <span>{lastSaleReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>نوع الكرت:</span>
                    <span>{lastSaleReceipt.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الكمية:</span>
                    <span>{lastSaleReceipt.qty} كرت</span>
                  </div>
                </div>

                {/* Core PIN */}
                {lastSaleReceipt.pin && (
                  <div className="bg-amber-50 dark:bg-slate-850 p-4 rounded-xl text-center border border-dashed border-[#B3803E]/30 space-y-2">
                    <span className="text-[10px] text-[#B3803E] font-black block">الرمـز الســري لشحن الكرت (PIN)</span>
                    <span className="text-2xl font-black font-mono tracking-widest text-[#B3803E] select-all block py-1">
                      {lastSaleReceipt.pin}
                    </span>
                    <span className="text-[9px] text-gray-400 font-semibold block">قم بإدخال هذا الرمز في صفحة تسجيل الدخول للشبكة</span>
                  </div>
                )}

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
                    طباعة إيصال حراري
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
