import React, { useState } from 'react';
import { Settings as SettingsIcon, Check, Store, Sparkles, Building, Percent, FileSignature } from 'lucide-react';

interface SettingsProps {
  apiKeyStatus: boolean;
  onSettingsSaved: (shopName: string, shopLogo: string) => void;
  currentShopName: string;
  currentShopLogo: string;
}

export const Settings: React.FC<SettingsProps> = ({ apiKeyStatus, onSettingsSaved, currentShopName, currentShopLogo }) => {
  const [shopName, setShopName] = useState(currentShopName);
  const [shopLogo, setShopLogo] = useState(currentShopLogo);
  const [vatPercent, setVatPercent] = useState('15');
  const [footerNote, setFooterNote] = useState('يرجى الاحتفاظ بالفاتورة للاسترجاع والضمان');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSettingsSaved(shopName, shopLogo);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn text-right" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-4 border-b border-slate-100">
          <SettingsIcon className="w-5.5 h-6 text-amber-500" />
          إعدادات النظام والشركة
        </h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shop Name */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-slate-400" />
                اسم المحل / الشركة *
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700"
              />
            </div>

            {/* Shop Logo URL */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-400" />
                رابط شعار الهوية البصرية (اللوجو)
              </label>
              <input
                type="text"
                value={shopLogo}
                onChange={(e) => setShopLogo(e.target.value)}
                placeholder="رابط رابط مباشر لشعارك..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700"
              />
            </div>

            {/* VAT */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-slate-400" />
                ضريبة القيمة المضافة (VAT) ٪
              </label>
              <input
                type="number"
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700 font-mono"
              />
            </div>

            {/* Invoice Footer Note */}
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-slate-400" />
                ملاحظة ذيل الفاتورة الافتراضية
              </label>
              <input
                type="text"
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500 transition-all text-slate-700"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {/* AI Key Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-500">
                حالة مفتاح الذكاء الاصطناعي (Gemini):{' '}
                <span className="text-emerald-600">متصل (AIzaSyCZh7HR...RSOg)</span>
              </span>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-sm transition-all shadow-md shadow-amber-500/15 flex items-center gap-2"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  تم الحفظ بنجاح!
                </>
              ) : (
                'حفظ وتطبيق التغييرات'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Visual Identity Section */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-4.5 h-5 text-amber-500" />
          معاينة هوية نظام الحسام فون
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          يعد «نظام الحسام فون» علامة فارقة في الإدارة الرقمية لمتاجر الاتصالات. يقوم النظام تلقائياً بتطبيق الهوية البصرية الفخمة المستوحاة من اللونين الذهبي والداكن على الكاشير، الفواتير، ومستندات الطباعة لضمان ظهور المحل بمظهر راقي أمام العملاء والموردين.
        </p>

        <div className="flex gap-4 items-center pt-4">
          <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {shopLogo ? (
              <img src={shopLogo} alt="Logo Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400 text-center font-bold">بدون شعار</span>
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">{shopName}</h4>
            <p className="text-xs text-slate-400">شعار وهوية المحل المتزامنة في الفواتير والتقارير</p>
          </div>
        </div>
      </div>
    </div>
  );
};
