import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { collection, onSnapshot, doc, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';

export interface POSItem {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category: string;
  code?: string;
  stock: number;
  unit: string;
  minStock?: number;
  imageUrl?: string;
  purchasePrice?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  points?: number;
  totalPurchases?: number;
  lastPurchaseDate?: string;
}

export interface CartItem {
  item: POSItem;
  qty: number;
  price: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  customerName: string;
  total: number;
  profit?: number;
  cashier?: string;
  items?: Array<{ name: string; quantity: number; price: number; total: number }>;
  paymentType?: string;
  walletName?: string;
  currency?: string;
}

export interface Debt {
  id: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  amountTotal: number;
  amountPaid: number;
  amountRemaining: number;
  createdAt: string;
  status: string;
  dueDate?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  cashier?: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userEmail: string;
  details?: string;
}

export interface NetworkService {
  id: string;
  name: string;
  type: 'balance' | 'cards';
  networkName: string;
  stockQty: number;
  costPrice: number;
  salePrice: number;
  denomination?: number | null;
  provider?: string;
  unit?: string;
}

interface DataContextType {
  items: POSItem[];
  customers: Customer[];
  categories: string[];
  categoriesDocs: { id: string; name: string }[];
  shopSettings: any;
  loading: boolean;
  
  // Shared Cart State across views to prevent data loss and increase response speed
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (item: POSItem, warnCallback?: (msg: string) => void, successCallback?: (msg: string) => void) => void;
  updateQty: (id: string, value: number | string, allowOverSell: boolean, errorCallback?: (msg: string) => void) => void;
  updatePrice: (id: string, newPrice: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  // Central Caches for Instant Page Navigation
  invoices: Invoice[];
  debts: Debt[];
  expenses: Expense[];
  activities: Activity[];
  networkServices: NetworkService[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<POSItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesDocs, setCategoriesDocs] = useState<{ id: string; name: string }[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Central Caches
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [networkServices, setNetworkServices] = useState<NetworkService[]>([]);

  // Default Fallbacks for Shop Settings
  const ensureSettingsDefaults = useCallback((data: any) => {
    if (!data) return data;
    const logo = defaultAppIcon;
    const name = "متجر الحسام فون";
    const phone = "784707050 - 778915055";
    const address = "صنعاء - مذبح - جوار فندق ضواحي صنعاء";
    const notes = "صيانة وبموجة هواتف\nبيع جوالات - صيانة برمجة - اكسسوارات - ادوات تجميل - نسخ الافلام والمسلسلات - طباعة\nشكراً لتعاملكم معنا! البضاعة المباعة لا ترد ولا تستبدل بعد 24 ساعة.";
    
    return {
      ...data,
      shopName: !data.shopName || data.shopName === "الحسام فون" ? name : data.shopName,
      shopPhone: !data.shopPhone || data.shopPhone === "77XXXXXXX" ? phone : data.shopPhone,
      shopAddress: !data.shopAddress || data.shopAddress === "صنعاء، اليمن" ? address : data.shopAddress,
      receiptNotes: !data.receiptNotes || (data.receiptNotes.includes("البضاعة المباعة لا ترد ولا تستبدل") && !data.receiptNotes.includes("صيانة وبموجة")) ? notes : data.receiptNotes,
      logoUrl: !data.logoUrl || data.logoUrl.includes("placeholder") ? logo : data.logoUrl,
      primaryColor: '#541919',
      secondaryColor: '#B3803E'
    };
  }, []);

  // Set up cached centralized subscriptions
  useEffect(() => {
    if (!user) {
      console.log("Central DataContext: No user signed in, skipping subscriptions.");
      setItems([]);
      setCustomers([]);
      setCategories([]);
      setCategoriesDocs([]);
      setShopSettings(null);
      setInvoices([]);
      setDebts([]);
      setExpenses([]);
      setActivities([]);
      setNetworkServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("Central DataContext: Attaching real-time optimized listeners for user:", user.email);
    let loadedItems = false;
    let loadedCustomers = false;
    let loadedCategories = false;
    let loadedSettings = false;

    const checkAllLoaded = () => {
      if (loadedItems && loadedCustomers && loadedCategories && loadedSettings) {
        setLoading(false);
      }
    };

    // 1. Items subscription
    const unsubItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as POSItem[];
      setItems(itemsData);
      loadedItems = true;
      checkAllLoaded();
    }, (error) => {
      console.error("Central Items fetch error:", error);
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    // 2. Customers subscription
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersData);
      loadedCustomers = true;
      checkAllLoaded();
    }, (error) => {
      console.error("Central Customers fetch error:", error);
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    // 3. Categories subscription
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const catsDocsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as any).name || ''
      }));
      setCategoriesDocs(catsDocsData);

      const cats = catsDocsData
        .map(d => d.name)
        .map(name => typeof name === 'string' ? name.trim() : '')
        .filter(Boolean);
      const uniqueCats = Array.from(new Set(cats)).filter(c => c !== 'الكل');
      setCategories(['الكل', ...uniqueCats]);
      loadedCategories = true;
      checkAllLoaded();
    }, (error) => {
      console.error("Central Categories fetch error:", error);
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    // 4. Shop Settings subscription
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setShopSettings(ensureSettingsDefaults(snap.data()));
      }
      loadedSettings = true;
      checkAllLoaded();
    }, (error) => {
      console.error("Central Settings fetch error:", error);
      loadedSettings = true;
      checkAllLoaded();
    });

    // 5. Invoices subscription (centralized cache)
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc'), limit(1500)), (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Invoice[]);
    }, (err) => console.error('Central Invoices listen error:', err));

    // 6. Debts subscription (centralized cache)
    const unsubDebts = onSnapshot(query(collection(db, 'debts'), orderBy('createdAt', 'desc')), (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Debt[]);
    }, (err) => console.error('Central Debts listen error:', err));

    // 7. Expenses subscription (centralized cache)
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]);
    }, (err) => console.error('Central Expenses listen error:', err));

    // 8. Activities subscription (centralized cache)
    const unsubActivities = onSnapshot(query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(150)), (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[]);
    }, (err) => console.error('Central Activities listen error:', err));

    // 9. Network Services subscription (centralized cache)
    const unsubNetwork = onSnapshot(collection(db, 'network_services'), (snap) => {
      setNetworkServices(snap.docs.map(d => ({ id: d.id, ...d.data() })) as NetworkService[]);
    }, (err) => console.error('Central Network services listen error:', err));

    // Fallback loading safety in case standard empty collections block it forever
    const backupTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => {
      console.log("Central DataContext: Cleaning up central listeners...");
      unsubItems();
      unsubCustomers();
      unsubCategories();
      unsubSettings();
      unsubInvoices();
      unsubDebts();
      unsubExpenses();
      unsubActivities();
      unsubNetwork();
      clearTimeout(backupTimeout);
    };
  }, [user, ensureSettingsDefaults]);

  // Optimized Action handlers with callbacks for localized error formatting without freezing the engine
  const addToCart = useCallback((item: POSItem, warnCallback?: (msg: string) => void, successCallback?: (msg: string) => void) => {
    if (item.stock <= 0) {
      if (warnCallback) warnCallback("عذراً، هذا الصنف غير متوفر في المخزن!");
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1, price: item.price }];
    });

    if (successCallback) {
      successCallback(`${item.name} تمت إضافته للسلة`);
    }
  }, []);

  const updateQty = useCallback((id: string, value: number | string, allowOverSell: boolean, errorCallback?: (msg: string) => void) => {
    setCart(prev => {
      const cartItem = prev.find(i => i.item.id === id);
      if (!cartItem) return prev;

      let newQty: number;
      if (typeof value === 'string') {
        newQty = parseInt(value) || 0;
      } else {
        newQty = Math.max(0, cartItem.qty + value);
      }

      if (newQty === 0) {
        return prev.filter(i => i.item.id !== id);
      }

      if (newQty > cartItem.item.stock && !allowOverSell) {
        if (errorCallback) errorCallback(`العذر، الكمية المتاحة هي ${cartItem.item.stock} فقط`);
        return prev.map(i => i.item.id === id ? { ...i, qty: cartItem.item.stock } : i);
      }

      return prev.map(i => i.item.id === id ? { ...i, qty: newQty } : i);
    });
  }, []);

  const updatePrice = useCallback((id: string, newPrice: number) => {
    setCart(prev => prev.map(i => i.item.id === id ? { ...i, price: newPrice } : i));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const value = useMemo(() => ({
    items,
    customers,
    categories,
    categoriesDocs,
    shopSettings,
    loading,
    cart,
    setCart,
    addToCart,
    updateQty,
    updatePrice,
    removeFromCart,
    clearCart,
    invoices,
    debts,
    expenses,
    activities,
    networkServices
  }), [
    items,
    customers,
    categories,
    categoriesDocs,
    shopSettings,
    loading,
    cart,
    addToCart,
    updateQty,
    updatePrice,
    removeFromCart,
    clearCart,
    invoices,
    debts,
    expenses,
    activities,
    networkServices
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
