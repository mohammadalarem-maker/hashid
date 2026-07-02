import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  BatteryCharging, 
  Headphones, 
  Droplet, 
  Zap, 
  Wifi, 
  Receipt, 
  Package, 
  Image as ImageIcon 
} from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt?: string;
  className?: string;
  category?: string;
}

const isInvalidSrc = (url?: string) => {
  if (!url) return true;
  const lowerUrl = url.trim().toLowerCase();
  return (
    lowerUrl === '' ||
    lowerUrl === 'null' ||
    lowerUrl === 'undefined' ||
    lowerUrl === 'placeholder' ||
    lowerUrl === 'none' ||
    lowerUrl === '#'
  );
};

export function ProductImage({ src, alt, className = 'w-full h-full object-cover', category }: ProductImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check validity when src changes
  const invalid = isInvalidSrc(src);

  useEffect(() => {
    if (invalid) {
      setError(true);
      setLoading(false);
      return;
    }

    setError(false);
    setLoading(true);

    // Safeguard timeout to prevent infinite spinner if network/CORS hangs
    const timer = setTimeout(() => {
      setLoading((currLoading) => {
        if (currLoading) {
          setError(true);
          return false;
        }
        return currLoading;
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [src, invalid]);

  // Determine fallback icon & styling when error or invalid URL
  const getFallbackDetails = () => {
    const cat = (category || '').toLowerCase();
    const name = (alt || '').toLowerCase();

    // Phones / Mobiles
    if (
      cat.includes('جوال') || cat.includes('هاتف') || cat.includes('موبايل') ||
      name.includes('جوال') || name.includes('ايفون') || name.includes('شاومي') || 
      name.includes('سامسونج') || name.includes('ردمي') || name.includes('تلفون') || 
      name.includes('هاتف') || name.includes('iphone') || name.includes('galaxy') || 
      name.includes('redmi') || name.includes('xiaomi')
    ) {
      return {
        icon: Smartphone,
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-600 dark:text-blue-450'
      };
    }

    // Chargers / Batteries / Cables
    if (
      cat.includes('شاحن') || cat.includes('بطار') || cat.includes('سلك') || 
      cat.includes('كيبل') || cat.includes('باور') ||
      name.includes('شاحن') || name.includes('بطار') || name.includes('سلك') || 
      name.includes('كابل') || name.includes('كيبل') || name.includes('باور') ||
      name.includes('شحن') || name.includes('سفاري') || name.includes('سلكي') ||
      name.includes('charger') || name.includes('battery') || name.includes('cable') || name.includes('powerbank')
    ) {
      return {
        icon: BatteryCharging,
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-600 dark:text-amber-400'
      };
    }

    // Headphones / Accessories
    if (
      cat.includes('سماعه') || cat.includes('سماعة') || cat.includes('اكسسوار') || 
      cat.includes('حامية') || cat.includes('ملصق') || cat.includes('كفر') ||
      name.includes('سماعه') || name.includes('سماعة') || name.includes('راس') || 
      name.includes('أذن') || name.includes('اكسسوار') || name.includes('حماية') || 
      name.includes('لاصق') || name.includes('كفر') || name.includes('غلاف') ||
      name.includes('headphone') || name.includes('earbud') || name.includes('buds') || name.includes('case')
    ) {
      return {
        icon: Headphones,
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        text: 'text-purple-600 dark:text-purple-400'
      };
    }

    // Water / Drinks
    if (
      cat.includes('ماء') || cat.includes('مياه') || cat.includes('شرب') ||
      name.includes('ماء') || name.includes('شرب') || name.includes('مياه') || name.includes('كوثر') ||
      name.includes('عصير') || name.includes('بارد') || name.includes('بورت') || name.includes('مشروب')
    ) {
      return {
        icon: Droplet,
        bg: 'bg-sky-50 dark:bg-sky-950/40',
        text: 'text-sky-600 dark:text-sky-400'
      };
    }

    // Networks / Wifi / Routers
    if (
      cat.includes('شبك') || cat.includes('خدم') || cat.includes('توصيل') || cat.includes('راوتر') ||
      name.includes('شبك') || name.includes('كارت') || name.includes('كرت') || name.includes('باقة') ||
      name.includes('روتر') || name.includes('راوتر') || name.includes('مودم') || name.includes('موديم') ||
      name.includes('wifi') || name.includes('router') || name.includes('net')
    ) {
      return {
        icon: Wifi,
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-600 dark:text-emerald-450'
      };
    }

    // Electricity / Light / Power
    if (
      cat.includes('كهرب') || cat.includes('لمب') || cat.includes('طاقة') ||
      name.includes('كهرب') || name.includes('لمبه') || name.includes('انارة') || name.includes('لد') || name.includes('led')
    ) {
      return {
        icon: Zap,
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        text: 'text-yellow-600 dark:text-yellow-450'
      };
    }

    // POS / Cashier
    if (
      cat.includes('كاشير') || cat.includes('طابع') || cat.includes('فواتير') ||
      name.includes('طابعة') || name.includes('ورق') || name.includes('كاشير') || name.includes('ثرمل')
    ) {
      return {
        icon: Receipt,
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-600 dark:text-rose-400'
      };
    }

    // Default package / item
    return {
      icon: Package,
      bg: 'bg-stone-50 dark:bg-slate-800/60',
      text: 'text-stone-500 dark:text-slate-400'
    };
  };

  if (invalid || error) {
    const { icon: Icon, bg, text } = getFallbackDetails();
    return (
      <div className={`w-full h-full flex items-center justify-center transition-all ${bg}`}>
        <Icon className={`w-5 h-5 shrink-0 transition-transform hover:scale-110 ${text}`} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt || 'صورة المنتج'}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
        referrerPolicy="no-referrer"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}
