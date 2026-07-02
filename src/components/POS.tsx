import React, { useState } from 'react';
import { Item, CartItem } from '../types';
import { Search, ShoppingCart, Trash2, Plus, Minus, User, CreditCard, Check, ShieldAlert } from 'lucide-react';

interface POSProps {
  items: Item[];
  onSaleCompleted: (cart: CartItem[], customerName: string, amount: number) => void;
}

export const POS: React.FC<POSProps> = ({ items, onSaleCompleted }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoiceDetails, setLastInvoiceDetails] = useState<{
    cart: CartItem[];
    customer: string;
    total: number;
    vat: number;
    subtotal: number;
    invoiceNo: string;
    date: string;
  } | null>(null);

  // Filter items in stock
  const filteredItems = items.filter(
    (item) =>
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      (item.item_number && item.item_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (item: Item) => {
    if (item.quantity <= 0) return;
    
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        if (existing.quantity >= item.quantity) return prev; // No stock left
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: item.id, item_name: item.item_name, price: item.price, quantity: 1, stock: item.quantity }];
    });
  };

  const updateQuantity = (id: string, amount: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.quantity + amount;
            if (nextQty <= 0) return null;
            if (i.stock !== undefined && nextQty > i.stock) return i; // Stock limit reached
            return { ...i, quantity: nextQty };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const subtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const vat = Math.round(subtotal * 0.15 * 100) / 100; // 15% VAT
  const total = subtotal + vat;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const nameOfCustomer = customerName.trim() || 'عميل نقدي سريع';
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const dateStr = new Date().toLocaleString('ar-SA');

    setLastInvoiceDetails({
      cart: [...cart],
      customer: nameOfCustomer,
      total,
      vat,
      subtotal,
      invoiceNo,
      date: dateStr,
    });

    onSaleCompleted(cart, nameOfCustomer, total);
    setPaymentSuccess(true);
    setCart([]);
    setCustomerName('');

    setTimeout(() => {
      setPaymentSuccess(false);
      setShowInvoice(true);
    }, 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn" dir="rtl">
      {/* Search and Products (Left Side) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">قائمة معروضات وهواتف نظام الحسام</h2>
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="ابحث بالاسم، الباركود أو الموديل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700 font-medium"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-auto right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 max-h-[60vh] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 col-span-2 text-slate-400 text-sm">
                لا توجد منتجات مطابقة لعملية البحث بالمستودع.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    item.quantity <= 0
                      ? 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none'
                      : 'bg-white border-slate-200 hover:border-amber-500 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold mb-1 block">
                        {item.category}
                      </span>
                      {item.quantity < 5 && item.quantity > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 font-bold animate-pulse">
                          مخزون منخفض
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base leading-tight truncate">
                      {item.item_name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {item.item_number ? `کود: ${item.item_number}` : `باركود: ${item.barcode}`}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                    <span className="text-sm font-semibold text-slate-500">
                      قوة المخزن: <span className="text-slate-800 font-mono font-bold">{item.quantity}</span>
                    </span>
                    <span className="text-base font-extrabold text-amber-600 font-mono">
                      {item.price} <span className="text-xs text-slate-500 font-sans">ر.س</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Cart side (Right Side) */}
      <div className="lg:col-span-5">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm sticky top-6 flex flex-col justify-between min-h-[70vh]">
          {/* Cart Header */}
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-slate-800">سلة المبيعات الحالية</h2>
              <span className="mr-auto px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 font-mono">
                {cart.reduce((acc, i) => acc + i.quantity, 0)} قطع
              </span>
            </div>

            {/* Cart Items */}
            <div className="divide-y divide-slate-100 max-h-[35vh] overflow-y-auto py-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm space-y-2">
                  <ShoppingCart className="w-8 h-8 mx-auto stroke-1" />
                  <p>ابدأ باختيار المنتجات لإضافتها للسلة.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between">
                    <div className="space-y-1 flex-1 min-w-0 pl-3">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{item.item_name}</h4>
                      <p className="text-xs text-amber-600 font-mono font-bold">
                        {item.price} ر.س / الحبة
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-slate-800 font-mono w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 px-1.5 bg-red-50 text-rose-500 rounded-lg hover:bg-red-100 hover:text-rose-600 transition-all mr-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Checkout section */}
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="اسم العميل (اختياري)..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700 font-medium"
                />
                <User className="w-4 h-5 text-slate-400 absolute left-auto right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{subtotal.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>ضريبة القيمة المضافة (١٥٪):</span>
                <span className="font-mono">{vat.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-dashed border-slate-200 pt-2">
                <span>الإجمالي النهائي:</span>
                <span className="text-amber-600 font-mono">{total.toLocaleString()} ر.س</span>
              </div>
            </div>

            {paymentSuccess ? (
              <div className="w-full bg-emerald-500 text-white rounded-2xl py-3 flex items-center justify-center gap-2 font-bold transition-all animate-bounce">
                <Check className="w-5 h-5" />
                تم إتمام العملية بنجاح!
              </div>
            ) : (
              <button
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                  cart.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/15'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                تأكيد الفاتورة والدفع
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Receipt Modal */}
      {showInvoice && lastInvoiceDetails && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden border border-slate-200 shadow-2xl animate-scaleUp">
            {/* Header info */}
            <div className="bg-slate-900 text-white p-6 relative">
              <h3 className="text-xl font-bold font-sans">فاتورة مبيعات الحسام فون</h3>
              <p className="text-xs text-amber-400 font-mono mt-1">الرقم المتسلسل: {lastInvoiceDetails.invoiceNo}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">التاريخ: {lastInvoiceDetails.date}</p>
              
              <button 
                onClick={() => setShowInvoice(false)}
                className="absolute left-6 top-6 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-xl text-xs transition-all"
              >
                إغلاق
              </button>
            </div>

            {/* Receipt details */}
            <div className="p-6 space-y-6">
              <div className="border-b border-dashed border-slate-100 pb-4">
                <p className="text-sm font-semibold text-slate-700">العميل: <span className="text-slate-900">{lastInvoiceDetails.customer}</span></p>
              </div>

              {/* Items in receipt */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400">تفاصيل السلة:</p>
                {lastInvoiceDetails.cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-700">{item.item_name} <span className="text-xs text-slate-400">× {item.quantity}</span></span>
                    <span className="font-mono text-slate-900">{(item.price * item.quantity).toLocaleString()} ر.س</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100 text-sm">
                <div className="flex justify-between text-slate-500 font-semibold text-xs">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{lastInvoiceDetails.subtotal.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-slate-500 font-semibold text-xs">
                  <span>الضريبة المضافة (١٥٪):</span>
                  <span className="font-mono">{lastInvoiceDetails.vat.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-base border-t border-dashed border-slate-200 pt-2">
                  <span>الإجمالي المدفوع:</span>
                  <span className="text-amber-600 font-mono">{lastInvoiceDetails.total.toLocaleString()} ر.س</span>
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Check className="w-3 h-3" />
                  فاتورة مدفوعة بالكامل
                </div>
                <p className="text-[10px] text-slate-400 pt-3">شكرًا لتعاملكم مع الحسام فون • يرجى الاحتفاظ بالفاتورة للاسترجاع والضمان</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
