import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const putBytes = uploadBytes;
export { putBytes };

/**
 * Utility to verify if an image file is secure and valid.
 */
export const validateImageFile = (file: File | Blob): { isValid: boolean; error?: string } => {
  // Check size limit: 10MB maximum (since we compress it heavily anyway)
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: 'حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 10 ميجابايت.'
    };
  }

  // Type check if available
  if ('type' in file && file.type) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.type) && !file.type.startsWith('image/')) {
      return {
        isValid: false,
        error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.'
      };
    }
  }

  return { isValid: true };
};

/**
 * Generously compresses and resizes any image source to A MAXIMUM dimension of 800px 
 * (preserving aspect ratio) and JPEG quality of 75%.
 * Returns a Uint8Array (ByteArray) ready to be uploaded directly using uploadBytes / putBytes.
 */
export const compressAndResizeToByteArray = async (imageSrc: File | Blob | string): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const handleLoad = () => {
      // Create canvas for resizing and compression
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('تعذر تهيئة canvas context لضغط الصورة.'));
        return;
      }

      // Calculate safe target dimensions (max width/height of 1024px keeping aspect ratio)
      let width = img.width;
      let height = img.height;
      const maxDimension = 1024;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Extract as JPEG at 65% (0.65) quality
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('فشل ضغط وتحويل الصورة إلى JPEG.'));
            return;
          }

          // Convert blob to Uint8Array (ByteArray)
          const reader = new FileReader();
          reader.onloadend = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            if (!arrayBuffer) {
              reject(new Error('تعذر قراءة مصفوفة بايتات الصورة.'));
              return;
            }
            resolve(new Uint8Array(arrayBuffer));
          };
          reader.onerror = (err) => reject(err);
          reader.readAsArrayBuffer(blob);
        },
        'image/jpeg',
        0.65
      );
    };

    img.onload = handleLoad;
    img.onerror = (err) => {
      console.error('Error loading image source into canvas element:', err);
      reject(new Error('فشل في معالجة مصفوفة الصورة. قد يكون الملف تالفاً أو غير مدعوم.'));
    };

    // Load source
    if (imageSrc instanceof File || imageSrc instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(imageSrc);
    } else if (typeof imageSrc === 'string') {
      img.src = imageSrc;
    } else {
      reject(new Error('مصدر الصورة غير مدعوم. يجب أن يكون ملف أو Blob أو Base64.'));
    }
  });
};

/**
 * Converts a Uint8Array (ByteArray) to Base64 format for high robustness/local-storage backup.
 */
export const convertByteArrayToBase64 = (byteArray: Uint8Array): Promise<string> => {
  return new Promise((resolve) => {
    const blob = new Blob([byteArray as any], { type: 'image/jpeg' });
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

/**
 * Uploads a compressed item image safely to Google Cloud Storage (Firebase Storage).
 * If the connection is lost or offline, it falls back to a lightweight Base64 string.
 */
export const uploadItemImage = async (
  fileOrSrc: File | Blob | string | Uint8Array, 
  folder: string = 'products'
): Promise<string> => {
  // 1. Process and compress the image to target Uint8Array (ByteArray)
  let byteArray: Uint8Array;
  
  if (fileOrSrc instanceof Uint8Array) {
    byteArray = fileOrSrc;
  } else {
    // Validate if it is File or Blob
    if (fileOrSrc instanceof File || fileOrSrc instanceof Blob) {
      const validation = validateImageFile(fileOrSrc);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }
    byteArray = await compressAndResizeToByteArray(fileOrSrc);
  }

  // Create helper to enforce a promise timeout
  const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMsg));
      }, ms);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  try {
    // Generate a clean name for storage
    const fileRef = ref(storage, `${folder}/${Date.now()}_product_image.jpg`);

    const uploadPromise = (async () => {
      const metadata = { contentType: 'image/jpeg' };
      // Standard upload using high-performance ByteArray
      const uploadResult = await uploadBytes(fileRef, byteArray, metadata);
      return await getDownloadURL(uploadResult.ref);
    })();

    const downloadUrl = await withTimeout(uploadPromise, 6000, 'استغرق رفع الصورة للـ Firebase وقتاً طويلاً جداً.');
    return downloadUrl;
  } catch (error: any) {
    console.warn("Firebase Storage Direct upload failed or timed out. Falling back to local offline Base64...", error);
    try {
      // Direct Base64 fallback (guarantees saving never hangs or fails)
      const base64String = await convertByteArrayToBase64(byteArray);
      return base64String;
    } catch (fallbackErr) {
      console.error("Critical failure during Base64 encoding fallback:", fallbackErr);
      throw new Error('فشل رفع وحفظ الصورة بالكامل. يرجى التحقق من اتصالك بالإنترنت والملف المختار.');
    }
  }
};
