import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { notify } from './notifications';
import { playWarningSound } from './alerts';

// Interface for item checking
interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  code: string;
}

class PushNotificationManager {
  private isCapacitor = Capacitor.isNativePlatform();

  constructor() {
    this.init();
  }

  private async init() {
    if (this.isCapacitor) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          console.log('PushNotificationManager:capacitor permissions not granted yet.');
        }
      } catch (err) {
        console.error('Failed to check Capacitor LocalNotifications permissions:', err);
      }
    }
  }

  /**
   * Request system-level notification permissions from the user
   */
  public async requestPermissions(): Promise<boolean> {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      notify.success('تم تفعيل نظام التنبيهات التفاعلية بنجاح! 🎉 سيتم استخدام الإشعارات والتأثيرات الصوتية داخل التطبيق.');
      return true;
    }

    if (this.isCapacitor) {
      try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display === 'granted') {
          notify.success('تم تفعيل إشعارات الهاتف بنجاح! 🔔');
          return true;
        } else {
          notify.info('تم تسجيل التنبيهات الصوتية والمرئية داخل النظام.');
          return true;
        }
      } catch (err) {
        console.error('Capacitor requestPermissions error:', err);
        return false;
      }
    } else {
      // standard Web API
      if (!('Notification' in window)) {
        notify.info('هذا المتصفح لا يدعم الإشعارات النظامية، سيتم استخدام التنبيهات المرئية والصوتية.');
        return false;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          notify.success('تم تفعيل إشعارات المتصفح بنجاح! 🔔');
          return true;
        } else {
          notify.info('تم تنشيط التنبيهات الصوتية والمرئية داخل المتجر بنجاح!');
          return true;
        }
      } catch (err) {
        console.error('Web notification permission request error:', err);
        return false;
      }
    }
  }

  /**
   * Check permission status
   */
  public async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      return 'granted';
    }

    if (this.isCapacitor) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'granted') return 'granted';
        if (perm.display === 'denied') return 'denied';
        return 'prompt';
      } catch (err) {
        return 'prompt';
      }
    } else {
      if (!('Notification' in window)) {
        return 'denied';
      }
      const perm = Notification.permission;
      if (perm === 'granted') return 'granted';
      if (perm === 'denied') return 'denied';
      return 'prompt';
    }
  }

  /**
   * Trigger a push/local notification immediately
   */
  public async sendNotification(title: string, body: string, itemId?: string, stock?: number) {
    // If specific item stock tracking is supplied, prevent redundant alerts
    if (itemId && stock !== undefined) {
      const storageKey = `notified_${itemId}`;
      let previousNotifiedStock: string | null = null;
      try {
        previousNotifiedStock = localStorage.getItem(storageKey);
      } catch {}
      
      // If we already alerted for this stock level or lower, do not spam.
      if (previousNotifiedStock !== null && parseInt(previousNotifiedStock, 10) === stock) {
        return; 
      }
      
      // Update the recorded notified stock
      try {
        localStorage.setItem(storageKey, stock.toString());
      } catch {}
    }

    // Play device warning chime and vibration
    playWarningSound();

    if (this.isCapacitor) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 1000000),
              title,
              body,
              schedule: { at: new Date(Date.now() + 50) },
              sound: 'beacon.wav',
              actionTypeId: 'OPEN_PRODUCT',
              extra: { itemId }
            }
          ]
        });
        console.log('Triggered capacitor local notification:', title);
      } catch (err) {
        console.warn('Capacitor LocalNotification failed, falling back to Web API:', err);
        this.fallbackWebNotification(title, body);
      }
    } else {
      this.fallbackWebNotification(title, body);
    }
  }

  private fallbackWebNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'https://i.imgur.com/gK9Jd74.png',
          dir: 'rtl',
          lang: 'ar'
        });
      } catch (err) {
        console.error('Standard Web Notification creation failed:', err);
        notify.info(`${title}: ${body}`);
      }
    } else {
      // In-app alert fallback
      notify.info(`⚠️ ${title}\n${body}`);
    }
  }

  /**
   * Core checker logic to scan low stock items and alert
   */
  public checkLowStockItems(items: LowStockItem[]) {
    items.forEach((item) => {
      const stock = item.stock || 0;
      const minStock = item.minStock || 0;

      if (stock <= minStock) {
        const title = `🚨 تنبيه حد الطلب الأدنى: ${item.name}`;
        const body = `كمية الصنف الحالية هي (${stock}) وهي مساوية أو أقل من حد الطلب الأدنى (${minStock}). يرجى إعادة تعبئة المخزون.`;
        this.sendNotification(title, body, item.id, stock);
      }
    });
  }

  /**
   * Trigger a test notification to verify permissions and system integration
   */
  public async triggerTestNotification() {
    const status = await this.checkPermissionStatus();
    if (status !== 'granted') {
      const granted = await this.requestPermissions();
      if (!granted) {
        notify.error('يرجى تمكين أذونات الإشعارات لإجراء الاختبار.');
        return;
      }
    }

    await this.sendNotification(
      '🔔 تجربة نظام الإشعارات',
      'تهانينا! نظام الإشعارات المحلية (Local Notifications) يعمل لديك بشكل ممتاز ويعمل كجهة تنبيه حد الطلب.'
    );
  }
}

export const pushNotificationsManager = new PushNotificationManager();
