import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ActivityDetails {
  [key: string]: any;
}

export const logActivity = async (
  action: string,
  recordId?: string,
  collectionName?: string,
  details?: ActivityDetails
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    let description = `${action}`;
    if (recordId) {
      description += ` (رقم المرجع: ${recordId})`;
    }
    if (details) {
      if (details.customerName) {
        description += ` للعميل: ${details.customerName}`;
      }
      if (details.total !== undefined) {
        description += ` بمبلغ: ${details.total.toLocaleString()} ر.ي`;
      }
      if (details.itemName) {
        description += ` للصنف: ${details.itemName}`;
      }
    }

    await addDoc(collection(db, 'activities'), {
      type: action,
      description: description,
      timestamp: new Date().toISOString(),
      userEmail: user.email || 'guest@example.com',
      userId: user.uid,
      userName: user.displayName || user.email || 'مستخدم غير معروف',
      recordId: recordId || null,
      collection: collectionName || null,
      details: details || {}
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
