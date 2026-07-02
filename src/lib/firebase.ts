import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Resolves an API path to an absolute URL if running inside a native mobile app container (Capacitor/Cordova)
 * or a local webview where relative paths would fail.
 */
export function getAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const origin = window.location.origin;
  const isMobileApp = origin.startsWith('capacitor:') || 
                       (origin.startsWith('http://localhost') && !origin.includes(':3000')) ||
                       origin.startsWith('file:') || 
                       origin.startsWith('ionic:');

  if (isMobileApp) {
    // Direct all mobile API calls to the hosted production Cloud Run server
    const backendBase = 'https://ais-pre-cx5hb7juzgarqxzrihn64x-433687768635.europe-west2.run.app';
    return `${backendBase}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  
  return path;
}

const app = initializeApp(firebaseConfig);

let firestoreInstance: any;

try {
  firestoreInstance = initializeFirestore(app as any, {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  } as any, (firebaseConfig as any).firestoreDatabaseId);
} catch (error) {
  console.warn("Failed to initialize Firestore with persistent local cache. Falling back to memory cache...", error);
  try {
    firestoreInstance = initializeFirestore(app as any, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache()
    } as any, (firebaseConfig as any).firestoreDatabaseId);
  } catch (secondaryError) {
    console.error("Secondary Firestore initialization failure, using basic fallback configuration...", secondaryError);
    firestoreInstance = initializeFirestore(app as any, {
      experimentalForceLongPolling: true
    } as any, (firebaseConfig as any).firestoreDatabaseId);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Firestone Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Insufficient permissions'))) {
       // Note: Insufficient permissions is expected if we don't have a test document, but offline is rare.
       console.warn("Firebase connection notice: ", error.message);
    }
  }
}

export async function runGeminiAIProductCategorizer(name: string): Promise<string> {
  try {
    const res = await fetch(getAbsoluteUrl('/api/categorize-product'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to fetch categorization');
    const data = await res.json();
    return data.category || 'عام';
  } catch (error) {
    console.error('Client Gemini Product Categorizer Error:', error);
    // Simple frontend local fallback
    const lower = name.toLowerCase();
    if (lower.includes('شاش') || lower.includes('سكرين')) return 'شاشات';
    if (lower.includes('شاحن') || lower.includes('شواحن') || lower.includes('charger')) return 'شواحن';
    if (lower.includes('كابل') || lower.includes('سلك') || lower.includes('كيبل') || lower.includes('cable')) return 'كابلات';
    if (lower.includes('بطار') || lower.includes('battery')) return 'بطاريات';
    if (lower.includes('سماع') || lower.includes('headphone') || lower.includes('speaker')) return 'سماعات';
    if (lower.includes('زجاج') || lower.includes('كفر') || lower.includes('جراب') || lower.includes('إكسسوار') || lower.includes('اكسسوار') || lower.includes('glass') || lower.includes('case')) return 'زجاج حماية وإكسسوارات';
    if (lower.includes('هاتف') || lower.includes('جوال') || lower.includes('phone') || lower.includes('mobile') || lower.includes('أجهزة')) return 'هواتف وأجهزة';
    return 'عام';
  }
}
