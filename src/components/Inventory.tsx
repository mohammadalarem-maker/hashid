import React, { useState } from 'react';
import { Item } from '../types';
import { Search, Plus, Trash2, Edit, Save, X, Ban, ShoppingBag, Barcode } from 'lucide-react';

interface InventoryProps {
  items: Item[];
  onItemAdded: (item: Item) => void;
  onItemDeleted: (id: string) => void;
  onItemUpdated: (item: Item) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ items, onItemAdded, onItemDeleted, onItemUpdated }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('شاشات');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemNumber, setItemNumber] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Item>>({});

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !itemQty) return;

    // Generate accurate structured barcode if empty
    const generatedBarcode = itemBarcode.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const newItem: Item = {
      id: `man-${Math.random().toString(36).substring(2, 9)}`,
      item_name: itemName.trim(),
      category: itemCategory,
      price: parseFloat(itemPrice) || 0,
      quantity: parseInt(itemQty) || 0,
      barcode: generatedBarcode,
      item_number: itemNumber.trim() || `H-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
    };

    onItemAdded(newItem);

    // Reset Form
    setItemName('');
    setItemPrice('');
    setItemQty('');
    setItemBarcode('');
    setItemNumber('');
    setShowAddForm(false);
  };

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const saveEdit = () => {
    if (!editingId) return;
    onItemUpdated({ ...editForm, id: editingId } as Item);
    setEditingId(null);
  };

  // Filter list
  const filtered = items.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      (item.item_number && item.item_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'الكل' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['الكل', 'شاشات', 'شواحن', 'كابلات', 'بطاريات', 'سماعات', 'زجاج حماية وإكسسوارات', 'هواتف وأجهزة', 'عام'];

  return (
    <div className="space-y-8 animate-fadeIn text-right" dir="rtl">
      {/* Search & Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="ابحث بالاسم، الباركود أو الموديل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all font-medium text-slate-700"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-auto right-3.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  selectedCategory === cat
                    ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md transition-all self-start md:self-auto shrink-0"
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" />
              إلغاء التعبئة
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              منتج يدوي جديد
            </>
          )}
        </button>
      </div>

      {/* Manual Entry Form */}
      {showAddForm && (
        <form onSubmit={handleAddNewItem} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">إدخال منتج جديد للنظام</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">اسم الصنف بالكامل *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="مثال: شاشة آيفون ١٣ برو أصلية"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">الفئة *</label>
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {categories.filter(c => c !== 'الكل').map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">رقم الموديل (شورت كود)</label>
              <input
                type="text"
                value={itemNumber}
                onChange={(e) => setItemNumber(e.target.value)}
                placeholder="مثال: IP13P-SCR"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-left"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">السعر الفردي بالريال (ر.س) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="مثال: 150"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-left"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">كمية المخزون الابتدائية *</label>
              <input
                type="number"
                required
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                placeholder="مثال: 10"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-left"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">سلسل الباركود (يترك فارغاً للتوليد التلقائي)</label>
              <input
                type="text"
                value={itemBarcode}
                onChange={(e) => setItemBarcode(e.target.value)}
                placeholder="مثال: 628100123456"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-left"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/10"
            >
              حفظ وتخزين الصنف
            </button>
          </div>
        </form>
      )}

      {/* Main Stock Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <th className="p-4 rounded-r-2xl">كود المنتج</th>
                <th className="p-4">اسم الصنف المنتشر</th>
                <th className="p-4">الفئة</th>
                <th className="p-4">سعر البيع</th>
                <th className="p-4">الكمية المتوفرة</th>
                <th className="p-4">رقم الباركود الدولي</th>
                <th className="p-4 rounded-l-2xl text-center">إجراءات الإشراف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-sm">
                    لا يتوفر أصناف مخزنة حالياً في هذه الفئة.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {editingId === item.id ? (
                      <>
                        <td className="p-4 font-mono font-bold">
                          <input
                            type="text"
                            value={editForm.item_number || ''}
                            onChange={(e) => setEditForm({ ...editForm, item_number: e.target.value })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono w-24"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editForm.item_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs w-48"
                          />
                        </td>
                        <td className="p-4">
                          <select
                            value={editForm.category || ''}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                          >
                            {categories.filter(c => c !== 'الكل').map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.price || 0}
                            onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono w-20"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={editForm.quantity || 0}
                            onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono w-16"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editForm.barcode || ''}
                            onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono w-32"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={saveEdit} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 ml-1">
                            <Save className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-mono text-xs text-slate-500 font-bold">{item.item_number}</td>
                        <td className="p-4 font-bold text-slate-800">{item.item_name}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{item.category}</span>
                        </td>
                        <td className="p-4 font-bold font-mono text-slate-800">{item.price} ر.س</td>
                        <td className="p-4 font-bold">
                          <span className={`font-mono ${item.quantity <= 3 ? 'text-rose-500' : 'text-slate-700'}`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-xs flex items-center gap-1.5 py-5">
                          <Barcode className="w-4 h-4 text-slate-400" />
                          {item.barcode}
                        </td>
                        <td className="p-4 text-center flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(item)} className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => onItemDeleted(item.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
