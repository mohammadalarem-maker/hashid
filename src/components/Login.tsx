import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, Loader2, Sparkles, Phone, Smartphone } from 'lucide-react';
import { notify } from '../lib/notifications';
import { playSound } from '../lib/sounds';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';

export const Login: React.FC = () => {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      playSound('error');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await loginWithEmail(email, password, rememberMe);
      playSound('success');
      notify.success('تم تسجيل الدخول بنجاح إلى متجر الحسام فون!');
    } catch (err: any) {
      console.error('Login error:', err);
      playSound('error');
      let friendlyMessage = 'خطأ في عملية تسجيل الدخول. تأكد من صحة البيانات.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'كلمة المرور أو البريد الإلكتروني غير صحيح.';
      } else if (err.code === 'auth/user-not-found') {
        friendlyMessage = 'هذا المستخدم غير مسجل في النظام.';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMessage = 'فشل الاتصال بالإنترنت. يرجى التحقق من الشبكة.';
      }
      setErrorMessage(friendlyMessage);
      notify.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper shortcut to auto fill admin credentials
  const handlePrefillAdmin = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEmail('faremazen3@gmail.com');
    setPassword('123456');
    setErrorMessage(null);
    try {
      playSound('click');
    } catch (err) {
      console.warn('Audio play failed or blocked:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#2D241E] flex flex-col justify-center items-center p-4" dir="rtl">
      {/* Container simulating a sleek premium dashboard view */}
      <div className="w-full max-w-md bg-white border border-[#EBE3DB] rounded-[2.5rem] p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Subtle upper dynamic background decoration resembling AlHoussam Phone branding */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-[#5E1A1A]/10 to-transparent rounded-full -mr-10 -mt-10 blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#8B7E74]/10 to-transparent rounded-full -ml-8 -mb-8 blur-lg"></div>

        {/* Store Logo/Badge resembling the real phone logo */}
        <div className="text-center relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-[1.5rem] bg-[#180F0A] border-2 border-[#E2A85C]/30 flex items-center justify-center text-white mb-4 shadow-xl shadow-amber-500/10 overflow-hidden">
            <img src={defaultAppIcon} alt="نظام الحسام فون" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-black text-[#5E1A1A] tracking-tight">بوابة نظام الحسام فون</h2>
          <p className="text-xs text-[#8B7E74] font-bold mt-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            نظام إدارة المبيعات والمخزن الذكي السحابي
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 font-bold leading-relaxed text-right animate-fadeIn">
            {errorMessage}
          </div>
        )}

        {/* Form elements */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* Email input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5E1A1A] mr-1 block">البريد الإلكتروني للعمل</label>
            <div className="relative">
              <input 
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full h-12 pl-4 pr-11 bg-[#FAF7F5] border border-[#EBE3DB] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5E1A1A]/20 transition-all font-semibold"
              />
              <Mail className="w-5 h-5 text-[#8B7E74] absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-[#5E1A1A] block">رمز المرور السري</label>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-12 pl-12 pr-11 bg-[#FAF7F5] border border-[#EBE3DB] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5E1A1A]/20 transition-all font-semibold"
              />
              <Lock className="w-5 h-5 text-[#8B7E74] absolute right-3.5 top-1/2 -translate-y-1/2" />
              
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-10 h-10 flex items-center justify-center text-[#8B7E74] hover:text-[#5E1A1A] absolute left-1 top-1/2 -translate-y-1/2 rounded-xl"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me option */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="rounded border-[#EBE3DB] text-[#5E1A1A] focus:ring-[#5E1A1A]/20 accent-[#5E1A1A]"
              />
              <span className="text-xs text-[#8B7E74] font-bold">تذكر تسجيل الدخول</span>
            </label>
          </div>

          {/* Main Action Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-4 bg-[#5E1A1A] text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-[#481212] transition-colors active:scale-98 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري التحقق من الهوية...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                <span>تسجيل الدخول للنظام</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-[10px] text-[#A89F95] font-sans">
          حقوق الطبع محفوظة © {new Date().getFullYear()} - مؤسسة الحسام لشبكات الاتصالات
        </div>

      </div>
    </div>
  );
};
