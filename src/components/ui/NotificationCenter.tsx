import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  X, 
  ChevronRight,
  Package,
  ExternalLink,
  CheckCheck
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { pushNotificationsManager } from '../../lib/pushNotifications';
import { useData } from '../../lib/DataContext';

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  code: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { items } = useData();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load read notification unique keys from localStorage
  const [readKeys, setReadKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('read_notification_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const lowStockItems = items
    .filter(item => (item.stock || 0) <= (item.minStock || 0))
    .map(item => ({
      id: item.id,
      name: item.name || '',
      stock: item.stock || 0,
      minStock: item.minStock || 0,
      code: item.code || '',
      key: `${item.id}_${item.stock}`
    }));

  useEffect(() => {
    if (lowStockItems.length > 0) {
      pushNotificationsManager.checkLowStockItems(lowStockItems);
    }
  }, [items]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveReadKeys = (newKeys: string[]) => {
    setReadKeys(newKeys);
    try {
      localStorage.setItem('read_notification_keys', JSON.stringify(newKeys));
    } catch (err) {
      console.error('Failed to save read notification keys:', err);
    }
  };

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allKeys = lowStockItems.map(item => item.key);
    const updatedKeys = Array.from(new Set([...readKeys, ...allKeys]));
    saveReadKeys(updatedKeys);
  };

  const markAsRead = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readKeys.includes(key)) {
      saveReadKeys([...readKeys, key]);
    }
  };

  const unreadItems = lowStockItems.filter(item => !readKeys.includes(item.key));
  const unreadCount = unreadItems.length;
  const hasNotifications = lowStockItems.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer border-none ${
          isOpen ? 'bg-secondary text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 && !isOpen ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] overflow-hidden"
          >
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-right">
                <h3 className="text-sm font-black text-primary flex items-center gap-2">
                   <Bell className="w-4 h-4 text-secondary" />
                   التنبيهات النظامية
                </h3>
                {unreadCount > 0 && (
                  <p className="text-[10px] text-red-500 font-bold">
                     لديك {unreadCount} تنبيه غير مقروء
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-black text-secondary hover:bg-secondary hover:text-white bg-secondary/10 px-2 py-1 rounded-lg border-none cursor-pointer transition-all"
                    title="تصفير الإشعارات وحذفها من البادج"
                  >
                    تصفير الإشعارات
                  </button>
                )}
                <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                  {lowStockItems.length}
                </span>
              </div>
            </div>

            {/* Local notifications control & testing panel */}
            <div className="px-4 py-2.5 bg-amber-50/40 border-b border-gray-100/80 flex items-center justify-between text-[11px] font-bold text-amber-900">
              <span className="flex items-center gap-1.5 shrink-0">
                📣 إشعارات الهاتف والنظام مفعلة؟
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await pushNotificationsManager.requestPermissions();
                  }}
                  className="px-2.5 py-1 bg-amber-700/90 text-white rounded-lg text-[10px] font-black hover:bg-amber-800 transition-colors cursor-pointer select-none border border-transparent"
                >
                  تمكين الاذونات
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await pushNotificationsManager.triggerTestNotification();
                  }}
                  className="px-2 py-1 bg-white border border-amber-200 text-amber-800 rounded-lg text-[10px] font-black hover:bg-amber-50 transition-colors cursor-pointer select-none"
                >
                  ارسال تجربة 🔔
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {lowStockItems.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                     <Package className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-400">لا توجد تنبيهات حالياً. المخزون سليم!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lowStockItems.map((item) => {
                    const isUnread = !readKeys.includes(item.key);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => { navigate('/inventory'); setIsOpen(false); }}
                        className={`p-4 transition-colors cursor-pointer group relative ${
                          isUnread ? 'bg-amber-50/15 hover:bg-amber-50/30' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3 text-right">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isUnread ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-red-50 text-red-500'
                          }`}>
                             <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-xs flex-1 line-clamp-1 ${isUnread ? 'font-black text-gray-900' : 'font-medium text-gray-500'}`}>
                                {item.name}
                              </p>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="غير مقروء" />
                              )}
                            </div>
                            <p className="text-[10px] text-red-600 font-bold">
                              المخزون حرج: {item.stock} فقط (الحد: {item.minStock})
                            </p>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[9px] text-gray-400 font-mono">CODE: {item.code}</span>
                              <div className="flex items-center gap-2">
                                {isUnread && (
                                  <button
                                    onClick={(e) => markAsRead(item.key, e)}
                                    className="text-[9px] bg-white border border-gray-200 text-gray-600 hover:text-secondary hover:border-secondary px-1.5 py-0.5 rounded transition-all font-bold flex items-center gap-1 cursor-pointer"
                                    title="تحديد كمقروء"
                                  >
                                    <CheckCheck className="w-3 h-3 text-secondary" />
                                    قراءة
                                  </button>
                                )}
                                <span className="text-[9px] text-secondary font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                   الإجراء <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {lowStockItems.length > 0 && (
              <button 
                onClick={() => { navigate('/inventory'); setIsOpen(false); }}
                className="w-full p-3 bg-primary text-white text-xs font-black hover:bg-opacity-95 transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                إدارة كافة الأصناف المنخفضة
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
