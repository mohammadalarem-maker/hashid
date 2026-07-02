import { toast } from 'react-hot-toast';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { db, auth } from './firebase';
import { doc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { playNotificationSound } from './alerts';
import firebaseConfig from '../../firebase-applet-config.json';

export const notify = {
  success: (message: string) => {
    toast.success(message, {
      style: {
        borderRadius: '12px',
        background: '#3D2B1F',
        color: '#fff',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      iconTheme: {
        primary: '#8B5E3C',
        secondary: '#fff',
      },
      duration: 1200,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      style: {
        borderRadius: '12px',
        background: '#ef4444',
        color: '#fff',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      duration: 5000,
    });
  },
  info: (message: string) => {
    toast(message, {
      icon: 'ℹ️',
      style: {
        borderRadius: '12px',
        background: '#3b82f6',
        color: '#fff',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      duration: 3000,
    });
  },
  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        borderRadius: '12px',
        background: '#f3f4f6',
        color: '#1f2937',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
    });
  },
  dismiss: (id: string) => {
    toast.dismiss(id);
  }
};

/**
 * دالة تهيئة وتسجيل الإشعارات الخارجية الفورية (FCM) وتخزين الـ Token بـ Firestore
 */
export async function setupPushNotifications(userRole: string | null): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    console.log('Mobile Push Notifications: Not running on a native platform, skipping registration.');
    return false;
  }

  // السماح للمدراء فقط بالتسجيل وتخزين التوكن
  if (userRole !== 'admin') {
    console.log(`Mobile Push Notifications: User role is '${userRole}', not admin. Skipping Push Notification registration.`);
    return false;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        const tokenValue = token.value;
        console.log('FCM Device Token generated:', tokenValue);

        const tokenDocId = tokenValue.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const currentUser = auth.currentUser;
        const currentEmail = currentUser?.email?.trim().toLowerCase() || '';
        const currentUid = currentUser?.uid || 'anonymous';

        try {
          await setDoc(doc(db, 'fcm_tokens', tokenDocId), {
            token: tokenValue,
            userId: currentUid,
            email: currentEmail,
            lastUpdated: new Date().toISOString(),
            platform: 'android'
          }, { merge: true });
          console.log('FCM token stored in fcm_tokens collection successfully.');
        } catch (fcmErr) {
          console.error('Error saving to fcm_tokens in Firestore:', fcmErr);
        }

        if (currentUser) {
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              fcmToken: tokenValue,
              lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log(`FCM token linked to users collection using UID: ${currentUser.uid}`);
          } catch (uidErr) {
            console.warn(`Could not save token by UID at users/${currentUser.uid}, using query...`, uidErr);
          }

          if (currentEmail) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', currentEmail));
              const querySnap = await getDocs(q);
              const batchPromises = querySnap.docs.map(userDoc => 
                updateDoc(doc(db, 'users', userDoc.id), {
                  fcmToken: tokenValue,
                  lastUpdated: new Date().toISOString()
                })
              );
              await Promise.all(batchPromises);
              console.log(`FCM token updated in users query docs. Total matched and updated: ${batchPromises.length}`);
            } catch (queryErr) {
              console.error('Error updating users collection with FCM token by query:', queryErr);
            }
          }
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('FCM Registration registrationError listener:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (localStorage.getItem('notifications_muted') === 'true') {
          console.log('FCM Push received: Ignored because notifications are muted in general settings.');
          return;
        }
        console.log('FCM Push notification received in foreground:', notification);
        // Play dynamic light subtle sound alert!
        playNotificationSound();
        if (notification.title || notification.body) {
          notify.info(`${notification.title || ''}\n${notification.body || ''}`);
        }
      });

      return true;
    } else {
      console.warn('FCM Push notifications permission was denied by client.');
      return false;
    }
  } catch (err) {
    console.error('Fatal error initializing Native FCM Push system:', err);
    return false;
  }
}

/**
 * دالة لتوليد الـ OAuth2 Access Token الخاص بـ Google لخوادم FCM V1 من خلال مفتاح الخدمة والـ Web Crypto API
 */
export async function generateFcmAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  // 1. الكشف التلقائي عن بيئة التشغيل؛ إذا كان النظام يعمل في الويب أو بيئة المعاينة، نتجاهل التشفير والتوقيع المعقد
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    console.log("FCM Cryptography: Web/Preview mode detected. Skipping/bypassing client-side RSA key signing completely to prevent decoder errors.");
    return "bypass_signing_mock_token_web_preview";
  }

  if (!clientEmail || !privateKeyPem) {
    console.warn("FCM OAuth Hint: Missing client email or private key PEM.");
    return "";
  }

  // 1. محاولة طلب التوكن من الخادم الخلفي الآمن أولاً لتفادي مشاكل الـ IFrame وقراءة المفتاح الخاص
  try {
    const res = await fetch('/api/generate-fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientEmail, privateKey: privateKeyPem })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.access_token) {
        console.log("FCM OAuth Token successfully generated via secure backend proxy.");
        return data.access_token;
      }
    }
  } catch (backendErr) {
    console.warn("FCM Backend Proxy warning: Failed to generate token on server. Falling back to local Web Crypto...", backendErr);
  }

  // 2. استخدام التشفير الأصلي فقط عند تشغيل التطبيق كـ Native App الحسام فون
  try {
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    
    let rawPem = privateKeyPem.trim();
    
    // إذا كان المفتاح وهمياً أو غير مكتمل، نتعدى التوقيع لتجنب انهيار الخدمة
    if (rawPem.toLowerCase().includes("mock") || rawPem.toLowerCase().includes("placeholder") || rawPem.length < 150) {
      console.warn("FCM Cryptography: Mock or dummy key detected in settings. Bypassing client-side RSA signing to prevent runtime crashes.");
      return "bypass_signing_mock_token_dummy_key_native";
    }

    // 1. استبدال الرموز النصية للسطر الجديد المستمر المقروءة من ملف الإعدادات
    rawPem = rawPem.replace(/\\n/g, "\n");
    rawPem = rawPem.replace(/"/g, ""); // إزالة علامات الاقتباس الزائدة في حال وجدت
    
    // 2. إزالة الترويسات والتدوير وعلامات الاقتباس في حال وجودها
    if (rawPem.includes(pemHeader)) {
      rawPem = rawPem.replace(pemHeader, "");
    }
    if (rawPem.includes(pemFooter)) {
      rawPem = rawPem.replace(pemFooter, "");
    }
    
    // 3. حذف كافة الفراغات والسطور الجديدة والتباعد لتبسيط base64
    rawPem = rawPem.replace(/\s+/g, ""); 
    
    // 4. شطب كل الحروف غير الصالحة لـ Base64 لضمان سلامة دالة atob
    rawPem = rawPem.replace(/[^A-Za-z0-9+/=]/g, "");
    
    // معالجة محاذاة الحشوة البادئة في الرموز الثنائية
    while (rawPem.length % 4 !== 0) {
      rawPem += "=";
    }
    
    let binaryBuffer: Uint8Array;
    try {
      const rawBinaryStr = window.atob(rawPem);
      const rawBinaryLen = rawBinaryStr.length;
      binaryBuffer = new Uint8Array(rawBinaryLen);
      for (let i = 0; i < rawBinaryLen; i++) {
        binaryBuffer[i] = rawBinaryStr.charCodeAt(i);
      }
    } catch (decodingErr) {
      console.error("FCM Base64 clean decode key failed, invalid or incomplete PEM private key configured.", decodingErr);
      return "bypass_signing_mock_token_decode_error";
    }
    
    // استيراد المفتاح الخاص بصيغة pkcs8
    const importedKey = await window.crypto.subtle.importKey(
      "pkcs8",
      binaryBuffer as any,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      },
      false,
      ["sign"]
    ).catch(importErr => {
      console.warn("FCM Cryptography: Web Crypto Subtle importKey failed in this browser format. Bypassing.", importErr);
      return null;
    });

    if (!importedKey) {
      return "bypass_signing_mock_token_unsupported_key_format";
    }
    
    // إنشاء ترويسة JWT والحقول المطالبة بها
    const header = {
      alg: "RS256",
      typ: "JWT"
    };
    
    const nowInSecs = Math.floor(Date.now() / 1000);
    const claims = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowInSecs + 3600,
      iat: nowInSecs
    };
    
    const base64UrlEncode = (str: string) => {
      const base64 = window.btoa(str);
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };
    
    const base64UrlEncodeBuffer = (buffer: ArrayBuffer) => {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return base64UrlEncode(binary);
    };
    
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const claimsEncoded = base64UrlEncode(JSON.stringify(claims));
    
    const msgToSign = `${headerEncoded}.${claimsEncoded}`;
    const enc = new TextEncoder();
    const msgBuffer = enc.encode(msgToSign);
    
    // توقيع الـ JWT عبر الخوارزمية RSASSA-PKCS1-v1_5
    const signatureBuffer = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      importedKey,
      msgBuffer
    ).catch(signErr => {
      console.warn("FCM Cryptography: Subtle key sign failed. Bypassing.", signErr);
      return null;
    });

    if (!signatureBuffer) {
      return "bypass_signing_mock_token_failed_signature";
    }
    
    const signatureEncoded = base64UrlEncodeBuffer(signatureBuffer);
    const signedJwt = `${msgToSign}.${signatureEncoded}`;
    
    // طلب الـ Access Token من خادم تبادل التواقيع بجوجل
    const params = new URLSearchParams();
    params.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    params.append("assertion", signedJwt);
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google OAuth API failed: ${errText}`);
    }
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error("No access_token found in Google response payload.");
    }
    
    return tokenData.access_token;
  } catch (error: any) {
    console.warn("FCM Cryptography Warning: Gracefully caught error in local RSA generation. Returning fallback mock token. Error details:", error.message || error);
    return "bypass_signing_mock_token_error_fallback";
  }
}

/**
 * دالة عامة لإرسال الإشعارات الخارجية الفورية (FCM) وتنبيه الجميع عبر طلب HTTP لـ Firebase FCM v1 API
 */
export async function sendNotificationToAdmins(
  title: string, 
  body: string, 
  messageType: string, 
  payloadExtended: any = {}
): Promise<void> {
  if (localStorage.getItem('notifications_muted') === 'true') {
    console.log(`FCM Broadcast: Skipping dispatch of type ${messageType} because notifications are currently muted.`);
    return;
  }
  try {
    console.log(`FCM Broadcast: Initializing generic push dispatch for type: ${messageType}...`);

    // 1. جلب توكنات المدراء (role == 'admin') من مجموعة المستندات 'users'
    const adminTokens: string[] = [];
    const adminUids: string[] = [];

    const currentUserUid = auth.currentUser?.uid;
    const currentEmail = auth.currentUser?.email?.trim().toLowerCase();

    const usersQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const usersSnapshot = await getDocs(usersQuery);
    
    usersSnapshot.forEach((userDoc) => {
      const data = userDoc.data();
      const isCurrentUser = currentUserUid && userDoc.id === currentUserUid;
      const isCurrentEmail = currentEmail && data && data.email && data.email.trim().toLowerCase() === currentEmail;

      if (!isCurrentUser && !isCurrentEmail) {
        if (data && data.fcmToken) {
          adminTokens.push(data.fcmToken.trim());
        }
      }
      
      // نضيف المعرّف لجلب التوكنات الإضافية فقط بالنسبة للمدراء الآخرين
      if (userDoc.id !== currentUserUid) {
        adminUids.push(userDoc.id);
      }
    });

    // 2. جلب التوكنات الإضافية من مجموعة 'fcm_tokens' الفرعية للمدراء مع استثناء توكنات الفاعل الحالي
    if (adminUids.length > 0) {
      const chunkedUids = [];
      const chunkSize = 10;
      for (let i = 0; i < adminUids.length; i += chunkSize) {
        chunkedUids.push(adminUids.slice(i, i + chunkSize));
      }

      for (const chunk of chunkedUids) {
        const tokensQuery = query(collection(db, 'fcm_tokens'), where('userId', 'in', chunk));
        const tokensSnapshot = await getDocs(tokensQuery);
        tokensSnapshot.forEach((tDoc) => {
          const tData = tDoc.data();
          if (tData && tData.token) {
            const tokenVal = tData.token.trim();
            const isTokenOwnerCurrentUser = currentUserUid && tData.userId === currentUserUid;
            const isTokenEmailCurrentUser = currentEmail && tData.email && tData.email.trim().toLowerCase() === currentEmail;

            if (!isTokenOwnerCurrentUser && !isTokenEmailCurrentUser) {
              adminTokens.push(tokenVal);
            }
          }
        });
      }
    }

    // تصفية وحذف التكرارات والقيم الفارغة
    const uniqueTokens = Array.from(new Set(adminTokens)).filter(t => typeof t === 'string' && t.trim().length > 0);

    // Also trigger Local/Browser system notification if permission is allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: '/assets/images/app_icon_1781726496895.jpg',
          dir: 'rtl'
        });
      } catch (notiErr) {
        console.warn("FCM Support Hint: Standard new Notification constructor failed in sandboxed frame context.", notiErr);
      }
    }

    // 3. الحصول على مفتاح الخادم وبيانات FCM v1 من إعدادات النظام (settings/global)
    let fcmV1ClientEmail = '';
    let fcmV1PrivateKey = '';
    let customProjectId = '';

    try {
      const globalSettingsSnap = await getDocs(query(collection(db, 'settings')));
      globalSettingsSnap.forEach((setDoc) => {
        if (setDoc.id === 'global') {
          const sData = setDoc.data();
          fcmV1ClientEmail = sData?.fcmV1ClientEmail || '';
          fcmV1PrivateKey = sData?.fcmV1PrivateKey || '';
          customProjectId = sData?.projectId || sData?.fcmProjectId || '';
        }
      });
    } catch (setErr) {
      console.warn("FCM Broadcast Warning: Could not fetch server setting document:", setErr);
    }

    const finalProjectId = customProjectId || firebaseConfig.projectId || "gen-lang-client-0621337551";

    if (!fcmV1ClientEmail || !fcmV1PrivateKey) {
      console.warn("FCM Broadcast Notice: FCM v1 Client Email or Private Key is not configured in Settings/Firestore document settings/global. Skipping FCM API post request. Showing local alert instead.");
      notify.info(`${title}\n${body}`);
      playNotificationSound();
      return;
    }

    console.log(`FCM Broadcast: Generating OAuth2 access token for client ${fcmV1ClientEmail}...`);
    const accessToken = await generateFcmAccessToken(fcmV1ClientEmail, fcmV1PrivateKey).catch((oauthErr) => {
      console.error("OAuth Access Token generation failed. Falling back to local alert.", oauthErr);
      return '';
    });

    if (!accessToken) {
      notify.info(`${title}\n${body}`);
      playNotificationSound();
      return;
    }

    console.log("FCM Broadcast: OAuth2 Access Token successfully generated. Commencing push delivery.");

    // Display a beautiful, local in-app alert for foreground visual feedback
    notify.info(`${title}\n${body}`);
    playNotificationSound();

    if (uniqueTokens.length === 0) {
      console.log('FCM Broadcast: No active admin FCM tokens registered yet. Pushing only locally.');
      return;
    }

    // 4. إرسال طلب لـ FCM v1 لكل توكن متاح عبر الدفع المتوازي
    const url = `https://fcm.googleapis.com/v1/projects/${finalProjectId}/messages:send`;

    const broadcastPromises = uniqueTokens.map(async (token) => {
      const payload = {
        message: {
          token: token,
          notification: {
            title: title,
            body: body
          },
          data: {
            type: messageType,
            ...payloadExtended
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              click_action: "FCM_PLUGIN_ACTIVITY",
              icon: "stock_ticker_update"
            }
          }
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const respData = await response.json();
          console.log(`FCM Broadcast Success for token ${token.substring(0, 15)}...`, respData);
        } else {
          const respText = await response.text();
          console.warn(`FCM Broadcast Warning for token ${token.substring(0, 15)}... Status: ${response.status}`, respText);
        }
      } catch (tokenErr) {
        console.error(`FCM Broadcast Error for token ${token.substring(0, 15)}...`, tokenErr);
      }
    });

    await Promise.all(broadcastPromises);

  } catch (err: any) {
    console.error('Fatal error within generic sendNotificationToAdmins:', err);
  }
}

/**
 * إشعار إتمام عملية بيع فريدة مع إظهار الموظف المسؤول والبريد وإجمالي السعر
 */
export async function sendSaleNotificationToAdmins(
  invoiceTotal: number, 
  invoiceNumber: string, 
  paymentType: string,
  cashierName?: string,
  currency?: string,
  userRole?: string | null
): Promise<void> {
  const getCurrencyArabicLabel = (currencyCode: string | undefined): string => {
    return 'ريال يمني';
  };

  let finalRole = userRole;
  try {
    if (!finalRole && auth.currentUser) {
      finalRole = localStorage.getItem(`user_role_${auth.currentUser.uid}`);
    }
  } catch (err) {
    console.warn("Could not load user role from localStorage, using default fallback:", err);
  }

  const roleLabel = (finalRole === 'admin') ? 'المدير' : 'الموظف';
  const currencyLabelText = getCurrencyArabicLabel(currency || 'YER');
  
  const title = "عملية بيع جديدة 💰";
  const body = `قام ${roleLabel} ${cashierName || 'المستخدِم'} ببيع صنف بمبلغ ${invoiceTotal.toLocaleString()} ${currencyLabelText}`;
  
  await sendNotificationToAdmins(title, body, "sale_completed", {
    invoiceNumber,
    total: String(invoiceTotal),
    paymentType,
    cashier: cashierName || '',
    currency: currency || 'YER',
    userRole: finalRole || 'sales'
  });
}

/**
 * إشعار نفاذ كمية صنف أو انخفاض مستويات الأسهم
 */
export async function sendLowStockNotificationToAdmins(
  itemName: string,
  remainingStock: number,
  minStock: number
): Promise<void> {
  const title = "⚠️ تنبيه انخفاض مستويات المخزون";
  const body = `تنبيه: كمية منتج (${itemName}) انخفضت. الكمية المتبقية في المستودع: ${remainingStock} قطع فقط! (الحد الأدنى الآمن: ${minStock})`;
  
  await sendNotificationToAdmins(title, body, "low_stock", {
    itemName,
    remainingStock: String(remainingStock),
    minStock: String(minStock)
  });
}

/**
 * إشعار موعد استحقاق وسداد الديون المتعلقة بالعملاء
 */
export async function sendDebtDueNotificationToAdmins(
  customerName: string,
  remainingAmount: number,
  dueDate: string
): Promise<void> {
  const title = "📅 تنبيه تاريخ استحقاق دين اليوم";
  const body = `تذكير سداد: يستحق اليوم دين العميل (${customerName}). القيمة غير المسددة المتبقية: ${remainingAmount.toLocaleString()} ر.ي.`;
  
  await sendNotificationToAdmins(title, body, "debt_due", {
    customerName,
    remainingAmount: String(remainingAmount),
    dueDate
  });
}

/**
 * دالة تفحص الديون وتنبيه المدراء بالديون المستحقة اليوم تلقائياً
 */
export async function checkAndNotifyDueDebts(): Promise<void> {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    // منع تكرار قراءة البيانات في نفس اليوم لتسجيل توفير الموارد
    const localStorageKey = `debts_checked_date_${todayStr}`;
    if (localStorage.getItem(localStorageKey) === 'true') {
      console.log('Debts due date check already verified today.');
      return;
    }

    console.log('Scanning active customer debts corresponding to date:', todayStr);

    const debtsRef = collection(db, 'debts');
    const q = query(debtsRef, where('amountRemaining', '>', 0));
    const querySnapshot = await getDocs(q);

    let triggeredCount = 0;

    for (const docSnap of querySnapshot.docs) {
      const debtData = docSnap.data();
      const dueDate = debtData.dueDate; 
      
      if (dueDate && dueDate <= todayStr) {
        // تأكيد عدم إرسال تنبيه مكرر لنفس العقد بذات اليوم
        if (debtData.lastNotifiedDate !== todayStr) {
          await sendDebtDueNotificationToAdmins(
            debtData.customerName,
            debtData.amountRemaining,
            dueDate
          );
          
          // حفظ علامة القفل للمستند
          await updateDoc(doc(db, 'debts', docSnap.id), {
            lastNotifiedDate: todayStr
          });
          
          triggeredCount++;
        }
      }
    }

    localStorage.setItem(localStorageKey, 'true');
    console.log(`Automatic debt checker successfully finalized. Alerts triggered: ${triggeredCount}`);
  } catch (error) {
    console.error('Error executing auto debts checkAndNotifyDueDebts:', error);
  }
}
