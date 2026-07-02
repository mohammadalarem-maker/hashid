import React, { useState } from 'react';
import { Item } from '../types';
import { Sparkles, Loader2, Plus, Check, ShieldAlert, AlertCircle, Edit, Save, Trash } from 'lucide-react';
import { getAbsoluteUrl } from '../lib/firebase';

interface AIParsingProps {
  onItemsImported: (newItems: Item[]) => void;
}

export const AIParsing: React.FC<AIParsingProps> = ({ onItemsImported }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<Item[]>([]);
  const [importCompleted, setImportCompleted] = useState(false);
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Item>>({});

  const handleAIScan = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setErrorStatus(null);
    setImportCompleted(false);

    try {
      const response = await fetch(getAbsoluteUrl('/api/parse-inventory'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.keyIsMissing) {
          throw new Error('لم يتم تعيين مفتاح Gemini API Key في بيئة التشغيل السحابية بالكامل. يرجى إضافته في إعدادات النظام.');
        }
        throw new Error(data.error || 'حدث خطأ غير متوقع أثناء استخراج البيانات.');
      }

      const itemsWithIds = data.map((item: any) => ({
        ...item,
        id: `ai-${Math.random().toString(36).slice(2, 9)}`,
      }));

      setParsedItems(itemsWithIds);
    } catch (err: any) {
      setErrorStatus(err.message || 'خطأ في الاتصال بالخادم الذكي.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setParsedItems(prev => prev.map(i => i.id === editingId ? { ...i, ...editForm } as Item : i));
    setEditingId(null);
  };

  const deleteItem = (id: string) => {
    setParsedItems(prev => prev.filter(i => i.id !== id));
  };

  const confirmImport = () => {
    if (parsedItems.length === 0) return;
    onItemsImported(parsedItems);
    setParsedItems([]);
    setInputText('');
    setImportCompleted(true);
    setTimeout(() => setImportCompleted(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Intro Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5.5 h-6 text-amber-500 fill-amber-500/10" />
          مستورد مخزون الحسام بالذكاء الاصطناعي
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          الصق قائمة المشتريات، كشف الفواتير، الرسائل، أو القوائم الواردة من الموردين بأي صيغة نصية عشوائية. سيقوم نظام الحسام بفهم النصوص تلقائياً واستخلاص المبيعات بالكامل، الكميات، الأسعار، الفئات، والرموز بضغطة زر واحدة.
        </p>

        {/* Text Input Area */}
        <div className="mt-6 space-y-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            placeholder="مثال:&#10;وصلنا اليوم من المندوب:&#10;- شاشات آيفون x سوداء عدد ١٢ حبة سعر الحبة ١٤٠ ريال&#10;- ٣ شواحن أنكر ٢٠ واط بسعر ٦٥ ر.س&#10;- كابلات آيفون قماش أصلية عدد ٢٠ حبة بسعر ٣٠ ريال"
            className="w-full h-44 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 text-slate-700 font-medium transition-all"
          ></textarea>

          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">شجّع الذكاء الاصطناعي على تقدير الباركودات ونوع الفئات تلقائياً.</span>
            <button
              onClick={handleAIScan}
              disabled={loading || !inputText.trim()}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md ${
                loading || !inputText.trim()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري قراءة وتحليل الكشف...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  بدء فك وتحليل البيانات بالـ AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorStatus && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 flex gap-3 text-sm leading-relaxed items-start animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">فشل جلب أو تحليل الكشف:</p>
            <p className="opacity-90">{errorStatus}</p>
          </div>
        </div>
      )}

      {/* Import Completed Alert */}
      {importCompleted && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex gap-3 text-sm items-center animate-bounce">
          <Check className="w-5 h-5 text-emerald-500" />
          <span className="font-bold">تهانينا! تم تحويل الكشف بنجاح وإدراجه بالكامل في مستودع ومخزن المنتجات.</span>
        </div>
      )}

      {/* Table Results */}
      {parsedItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-800">المنتجات المستخرجة قبل الاستيراد</h3>
              <p className="text-xs text-slate-500 mt-1">الرجاء مراجعة البيانات المستخلصة، وتعديل أي خانة يدوياً قبل التأكيد.</p>
            </div>
            <button
              onClick={confirmImport}
              className="px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md shadow-emerald-600/10 transition-all"
            >
              <Check className="w-4 h-4" />
              تأكيد وإدراج المنتجات ({parsedItems.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="p-4 rounded-r-2xl">اسم المنتج</th>
                  <th className="p-4">الفئة</th>
                  <th className="p-4">الكمية</th>
                  <th className="p-4">السعر الفردي</th>
                  <th className="p-4">الباركود</th>
                  <th className="p-4 rounded-l-2xl text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {parsedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {editingId === item.id ? (
                      <>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editForm.item_name || ''}
                            onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <select
                            value={editForm.category || ''}
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                          >
                            {['شاشات', 'شواحن', 'كابلات', 'بطاريات', 'سماعات', 'زجاج حماية وإكسسوارات', 'هواتف وأجهزة', 'عام'].map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={editForm.quantity || 0}
                            onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-20 font-mono"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={editForm.price || 0}
                            onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-24 font-mono"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editForm.barcode || ''}
                            onChange={e => setEditForm({ ...editForm, barcode: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-36 font-mono"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={saveEdit} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 ml-1">
                            <Save className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-bold text-slate-800">{item.item_name}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{item.category}</span>
                        </td>
                        <td className="p-4 font-bold font-mono">{item.quantity}</td>
                        <td className="p-4 font-bold text-slate-800 font-mono">{item.price} ر.س</td>
                        <td className="p-4 text-slate-500 font-mono">{item.barcode}</td>
                        <td className="p-4 text-center flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(item)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
