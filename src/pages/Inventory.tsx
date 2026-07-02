import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit2, 
  Barcode, 
  FileInput, 
  Sparkles, 
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  Camera,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { useData } from '../lib/DataContext';
import { useTranslation } from '../lib/translations';
import { compressAndResizeToByteArray, uploadItemImage } from '../lib/imageStorage';
import BarcodeScanner from '../components/ui/BarcodeScanner';
import { exportToCSVInBackground } from '../lib/backgroundExporter';
import { runGeminiAIProductCategorizer } from '../lib/firebase';
import { useConfirm } from '../lib/ConfirmContext';
import { ProductImage } from '../components/ProductImage';
import { AIParsing } from '../components/AIParsing';

const getCurrencySymbol = (currencyCode: string | undefined): string => {
  return 'ر.ي';
};

export default function Inventory() {
  const { t } = useTranslation();
  const { items, categories, loading, shopSettings } = useData();
  const { confirm } = useConfirm();

  // Selected filters and queries states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  
  // Barcode Camera triggers
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Quick Stocktake (الجرد السريع عبر الكاميرا) states
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [isStocktakeScannerOpen, setIsStocktakeScannerOpen] = useState(false);
  const [stocktakeMode, setStocktakeMode] = useState<'auto' | 'manual'>('manual');
  const [stocktakeAutoAmount, setStocktakeAutoAmount] = useState<number>(1);
  const [stocktakeScannedCode, setStocktakeScannedCode] = useState('');
  const [stocktakeScannedItem, setStocktakeScannedItem] = useState<any | null>(null);
  const [stocktakeCountedQty, setStocktakeCountedQty] = useState<number | string>(0);
  const [stocktakeHistory, setStocktakeHistory] = useState<any[]>([]);
  const [linkingSearchQuery, setLinkingSearchQuery] = useState('');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState<number | string>(0);
  const [purchasePrice, setPurchasePrice] = useState<number | string>(0);
  const [stock, setStock] = useState<number | string>(0);
  const [minStock, setMinStock] = useState<number | string>(5);
  const [unit, setUnit] = useState('قطعة');
  const [itemCategory, setItemCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [currency, setCurrency] = useState<string>('YER');

  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  
  // Custom AI Categorization Loading Spinner
  const [aiCategorizing, setAiCategorizing] = useState(false);

  // AI Ingestion Widget states
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [activeAITab, setActiveAITab] = useState<'direct' | 'interactive'>('direct');
  const [aiIngestText, setAiIngestText] = useState('');
  const [aiIngestFile, setAiIngestFile] = useState<File | null>(null);
  const [aiIngestProgress, setAiIngestProgress] = useState(0);
  const [aiIngestStatus, setAiIngestStatus] = useState('');
  const [aiIngestLoading, setAiIngestLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [visibleInventoryLimit, setVisibleInventoryLimit] = useState(30);

  useEffect(() => {
    setVisibleInventoryLimit(30);
  }, [searchQuery, selectedCategory]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (validTypes.includes(droppedFile.type)) {
        setAiIngestFile(droppedFile);
      } else {
        notify.error('الرجاء رفع ملف صورة (JPG, PNG) أو مستند (PDF) فقط.');
      }
    }
  };

  // Helper function to access live "categories" dynamically
  const cleanAndMapCategory = (itemObj: any): string => {
    const categoryKeys = [
      'category',
      'الفئة',
      'الفئة ومجموعات الصنف',
      'الفئه',
      'النوع',
      'type',
      'group',
      'مجموعة',
      'تصنيف',
      'فئه'
    ];
    
    let rawCategory = '';
    for (const key of categoryKeys) {
      if (itemObj[key] !== undefined && itemObj[key] !== null) {
        rawCategory = String(itemObj[key]).trim();
        break;
      }
    }

    if (!rawCategory) {
      const keys = Object.keys(itemObj);
      const fuzzyKey = keys.find(k => {
        const kl = k.toLowerCase();
        return kl.includes('cat') || kl.includes('فئ') || kl.includes('تصنيف') || kl.includes('نوع');
      });
      if (fuzzyKey) {
        rawCategory = String(itemObj[fuzzyKey]).trim();
      }
    }

    if (!rawCategory) {
      return 'عام';
    }

    const normalizeText = (text: string): string => {
      return text
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/[ةه]/g, 'ه')
        .replace(/\s+/g, '')
        .toLowerCase();
    };

    const normalizedRaw = normalizeText(rawCategory);
    const systemCategories = categories.filter(c => c !== 'الكل');

    // 1. Exact match
    for (const sysCat of systemCategories) {
      if (normalizeText(sysCat) === normalizedRaw) {
        return sysCat;
      }
    }

    // 2. Fuzzy inclusion match
    for (const sysCat of systemCategories) {
      const normSys = normalizeText(sysCat);
      if (normSys.includes(normalizedRaw) || normalizedRaw.includes(normSys)) {
        return sysCat;
      }
    }

    // 3. Synonym dictionary matching
    const synonymMap: Record<string, string> = {
      'اكسسوار': 'اكسسوارات',
      'جراب': 'اكسسوارات',
      'كفر': 'اكسسوارات',
      'لاصق': 'اكسسوارات',
      'حمايه': 'اكسسوارات',
      'شاحن': 'شواحن',
      'بطاريه': 'بطاريات',
      'سماعه': 'سماعات',
      'كبل': 'كابلات',
      'سلك': 'كابلات',
      'جوال': 'أجهزة كاشير وجوالات',
      'هاتف': 'أجهزة كاشير وجوالات',
      'تلفون': 'أجهزة كاشير وجوالات',
      'برنامج': 'برمجيات كاشير',
      'كاميرا': 'أجهزة مراقبة',
      'مراقبه': 'أجهزة مراقبة',
      'شبك': 'شبكات',
      'باقه': 'بطاقات إنترنت وشبكات',
      'كرت': 'بطاقات إنترنت وشبكات',
    };

    for (const [key, target] of Object.entries(synonymMap)) {
      if (normalizedRaw.includes(normalizeText(key))) {
        const finalMatch = systemCategories.find(c => 
          normalizeText(c).includes(normalizeText(target)) || 
          normalizeText(target).includes(normalizeText(c))
        );
        if (finalMatch) return finalMatch;
      }
    }

    // Fallback to "عام" or default category if no match
    const defaultCat = systemCategories.find(c => c.includes('عام') || c.includes('أخرى') || c.includes('اخرى')) || 'عام';
    return defaultCat;
  };

  const handleAIInjest = async () => {
    if (!aiIngestText.trim() && !aiIngestFile) {
      notify.error('الرجاء كتابة نص فاتورة أو رفع ملف/صورة أولاً للتحليل.');
      return;
    }

    setAiIngestLoading(true);
    setAiIngestProgress(20);
    setAiIngestStatus('قراءة وتحضير الملف...');

    try {
      let fileData = '';
      let mimeType = '';

      if (aiIngestFile) {
        // Convert file to Base64
        const filePromise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(aiIngestFile);
          reader.onload = () => {
            const result = reader.result as string;
            // Capture base64 portion
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = (e) => reject(e);
        });

        fileData = await filePromise;
        mimeType = aiIngestFile.type;
      }

      setAiIngestProgress(50);
      setAiIngestStatus('التحليل الذكي عبر محرك Gemini 3.5 Flash...');

      const response = await fetch('/api/ai-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiIngestText,
          fileData: fileData || undefined,
          mimeType: mimeType || undefined,
          fileName: aiIngestFile ? aiIngestFile.name : undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'فشلت عملية التحليل بالذكاء الاصطناعي.');
      }

      const resData = await response.json();
      if (!resData.success || !Array.isArray(resData.items)) {
        throw new Error('لم يتم استخراج قائمة منتجات صالحة من مخرجات الذكاء الاصطناعي.');
      }

      const extractedItems = resData.items;
      if (extractedItems.length === 0) {
        notify.info('لم يتمكن الذكاء الاصطناعي من العثور على أي منتجات صالحة في الإدخال.');
        setAiIngestProgress(0);
        setAiIngestStatus('');
        setAiIngestLoading(false);
        return;
      }

      setAiIngestProgress(80);
      setAiIngestStatus(`تم العثور على ${extractedItems.length} منتج. جاري حقن البيانات بالفايربيس...`);

      let insertedCount = 0;
      let updatedCount = 0;
      const addedCats = new Set<string>();
      const systemCategories = categories.filter((c: any) => c !== 'الكل');

      for (const extractedItem of extractedItems) {
        const rawBarcode = extractedItem.barcode !== undefined && extractedItem.barcode !== null ? String(extractedItem.barcode) : '';
        const itemBarcode = rawBarcode.trim();
        // Fallback barcode if empty with 69 prefix
        const finalBarcode = itemBarcode || `69${Math.floor(1000000000 + Math.random() * 9000000000)}`;

        const matchedCategory = cleanAndMapCategory(extractedItem);

        // Dynamically add category to Firestore if it doesn't exist
        if (matchedCategory && matchedCategory.trim() && matchedCategory !== 'عام' && 
            !systemCategories.some((c: any) => c.trim() === matchedCategory.trim()) && !addedCats.has(matchedCategory.trim())) {
          addedCats.add(matchedCategory.trim());
          const catDocId = `cat_${Math.floor(Math.random() * 90000) + 10000}`;
          await setDoc(doc(db, 'categories', catDocId), {
            id: catDocId,
            name: matchedCategory.trim(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        const rawName = extractedItem.name !== undefined && extractedItem.name !== null ? String(extractedItem.name) : 'منتج مستخرج';
        const cleanName = rawName.trim();

        const rawUnit = extractedItem.unit !== undefined && extractedItem.unit !== null ? String(extractedItem.unit) : 'قطعة';
        const cleanUnit = rawUnit.trim();

        // Safe price and quantity conversion
        const salePriceVal = Number(extractedItem.salePrice) || Number(extractedItem.price) || 0;
        const purchasePriceVal = Number(extractedItem.purchasePrice) || Math.round(salePriceVal * 0.70);
        const quantityVal = Number(extractedItem.quantity) || Number(extractedItem.stock) || 1;
        const currencyVal = extractedItem.currency || 'YER';

        // Check if barcode already exists
        const existing = items.find((it: any) => (it.code || '').trim() === finalBarcode);

        if (existing) {
          // Increment stock & update prices
          const updatedStock = (existing.stock || 0) + quantityVal;
          await setDoc(doc(db, 'items', existing.id), {
            ...existing,
            stock: updatedStock,
            price: salePriceVal || existing.price || 0,
            purchasePrice: purchasePriceVal || existing.purchasePrice || 0,
            category: matchedCategory || existing.category || 'عام',
            currency: currencyVal,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          updatedCount++;
        } else {
          // Generate new document
          const docId = `item_${Math.floor(Math.random() * 900000) + 100000}`;
          await setDoc(doc(db, 'items', docId), {
            id: docId,
            name: cleanName,
            code: finalBarcode,
            price: salePriceVal,
            purchasePrice: purchasePriceVal,
            stock: quantityVal,
            minStock: 5,
            unit: cleanUnit,
            category: matchedCategory,
            currency: currencyVal,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          insertedCount++;
        }
      }

      setAiIngestProgress(100);
      setAiIngestStatus('اكتمل الحقن الجماعي بنجاح!');
      notify.success(`🔮 ذكاء الحسام: تم حقن ${insertedCount} صنف جديد، وتحديث كميات ${updatedCount} صنف مكرر بنجاح!`);

      // Clear inputs
      setAiIngestText('');
      setAiIngestFile(null);

      // Close widget after a delay
      setTimeout(() => {
        setAiIngestProgress(0);
        setAiIngestStatus('');
        setAiIngestLoading(false);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'حدث خطأ مجهول أثناء التحليل والحقن.');
      setAiIngestProgress(0);
      setAiIngestStatus('');
      setAiIngestLoading(false);
    }
  };

  const handleImportFromAIParsing = async (newItems: any[]) => {
    const toastId = notify.loading('جاري فحص وتخزين المنتجات المستوردة في الفايربيس...');
    let insertedCount = 0;
    let updatedCount = 0;
    try {
      const addedCats = new Set<string>();
      const systemCategories = categories.filter((c: any) => c !== 'الكل');

      for (const extractedItem of newItems) {
        const rawBarcode = extractedItem.barcode !== undefined && extractedItem.barcode !== null ? String(extractedItem.barcode) : '';
        const itemBarcode = rawBarcode.trim();
        const finalBarcode = itemBarcode || `69${Math.floor(1000000000 + Math.random() * 9000000000)}`;

        const matchedCategory = cleanAndMapCategory(extractedItem);

        // Dynamically add category to Firestore if it doesn't exist
        if (matchedCategory && matchedCategory.trim() && matchedCategory !== 'عام' && 
            !systemCategories.some((c: any) => c.trim() === matchedCategory.trim()) && !addedCats.has(matchedCategory.trim())) {
          addedCats.add(matchedCategory.trim());
          const catDocId = `cat_${Math.floor(Math.random() * 90000) + 10000}`;
          await setDoc(doc(db, 'categories', catDocId), {
            id: catDocId,
            name: matchedCategory.trim(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        const rawName = extractedItem.item_name !== undefined && extractedItem.item_name !== null ? String(extractedItem.item_name) : 'منتج مستخرج';
        const cleanName = rawName.trim();

        // Check if barcode already exists
        const existing = items.find((it: any) => (it.code || '').trim() === finalBarcode);

        const salePriceVal = Number(extractedItem.price) || 0;
        const purchasePriceVal = Math.round(salePriceVal * 0.70);
        const quantityVal = Number(extractedItem.quantity) || 1;
        const currencyVal = extractedItem.currency || 'YER';

        if (existing) {
          // Increment stock & update prices
          const updatedStock = (existing.stock || 0) + quantityVal;
          await setDoc(doc(db, 'items', existing.id), {
            ...existing,
            stock: updatedStock,
            price: salePriceVal || existing.price || 0,
            currency: currencyVal,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          updatedCount++;
        } else {
          // Generate new document
          const docId = `item_${Math.floor(Math.random() * 900000) + 100000}`;
          await setDoc(doc(db, 'items', docId), {
            id: docId,
            name: cleanName,
            code: finalBarcode,
            price: salePriceVal,
            purchasePrice: purchasePriceVal,
            stock: quantityVal,
            minStock: 5,
            unit: 'قطعة',
            category: matchedCategory,
            currency: currencyVal,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          insertedCount++;
        }
      }
      notify.dismiss(toastId);
      notify.success(`🔮 مستورد الحسام: تم إدراج ${insertedCount} صنف جديد وتحديث كميات ${updatedCount} صنف بنجاح!`);
      setIsWidgetOpen(false); // Close AI panel on complete
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'حدث خطأ أثناء حفظ الأصناف المستوردة.');
    }
  };

  useEffect(() => {
    // Select default category once Categories list loads
    const firstCat = categories.filter(c => c !== 'الكل')?.[0] || 'أجهزة كاشير وجوالات';
    if (!itemCategory) {
      setItemCategory(firstCat);
    }
  }, [categories, itemCategory]);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    const testCode = String(Math.floor(Math.random() * 900000000) + 100000000);
    setCode(testCode);
    setPrice(0);
    setPurchasePrice(0);
    setStock(15);
    setMinStock(5);
    setUnit('قطعة');
    const defaultCat = categories.filter(c => c !== 'الكل')?.[0] || 'عام';
    setItemCategory(defaultCat);
    setImageUrl('');
    setCurrency('YER');
    setIsModalOpen(true);
  };

  const openAddModalWithCode = (scannedCode: string) => {
    setEditingItem(null);
    setName('');
    setCode(scannedCode);
    setPrice(0);
    setPurchasePrice(0);
    setStock(1);
    setMinStock(5);
    setUnit('قطعة');
    const defaultCat = categories.filter(c => c !== 'الكل')?.[0] || 'عام';
    setItemCategory(defaultCat);
    setImageUrl('');
    setCurrency('YER');
    setIsModalOpen(true);
  };

  const handleStocktakeScan = async (scannedVal: string) => {
    const cleanCode = scannedVal.trim();
    setStocktakeScannedCode(cleanCode);
    setLinkingSearchQuery('');
    
    const found = items.find((item: any) => (item.code || '').trim() === cleanCode);
    
    if (found) {
      setStocktakeScannedItem(found);
      if (stocktakeMode === 'auto') {
        const prevStock = found.stock || 0;
        const addAmount = Number(stocktakeAutoAmount) || 1;
        const newStock = prevStock + addAmount;
        
        try {
          await setDoc(doc(db, 'items', found.id), {
            ...found,
            stock: newStock,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          setStocktakeHistory(prev => [
            {
              id: found.id,
              name: found.name,
              code: cleanCode,
              previousStock: prevStock,
              newStock: newStock,
              type: 'auto_increment',
              amount: addAmount,
              timestamp: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            },
            ...prev
          ]);
          
          notify.success(`📊 جرد سريع (+${addAmount}): تم تحديث (${found.name}) إلى الكمية الجديدة ${newStock}`);
        } catch (err: any) {
          console.error(err);
          notify.error(`❌ فشل التحديث التلقائي للمخزون: ${err.message}`);
        }
      } else {
        setStocktakeCountedQty(found.stock || 0);
        notify.info(`🔍 تم العثور على المنتج: ${found.name}`);
      }
    } else {
      setStocktakeScannedItem(null);
      notify.info(`⚠️ باركود غير مسجل: ${cleanCode}`);
    }
  };

  const submitManualStocktake = async () => {
    if (!stocktakeScannedItem) return;
    
    const prevStock = stocktakeScannedItem.stock || 0;
    const newStock = Number(stocktakeCountedQty);
    
    try {
      await setDoc(doc(db, 'items', stocktakeScannedItem.id), {
        ...stocktakeScannedItem,
        stock: newStock,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setStocktakeHistory(prev => [
        {
          id: stocktakeScannedItem.id,
          name: stocktakeScannedItem.name,
          code: stocktakeScannedCode,
          previousStock: prevStock,
          newStock: newStock,
          type: 'manual_set',
          timestamp: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ]);
      
      notify.success(`📦 جرد يدوي: تم تحديث كمية (${stocktakeScannedItem.name}) إلى العداد ${newStock} بنجاح!`);
      setStocktakeScannedItem(null);
      setStocktakeScannedCode('');
    } catch (err: any) {
      console.error(err);
      notify.error(`❌ فشل حفظ تعديل الجرد: ${err.message}`);
    }
  };

  const handleLinkBarcode = async (product: any) => {
    try {
      await setDoc(doc(db, 'items', product.id), {
        ...product,
        code: stocktakeScannedCode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      notify.success(`🔗 تم ربط الباركود ${stocktakeScannedCode} بمنتج (${product.name}) بنجاح!`);
      
      const updatedItem = { ...product, code: stocktakeScannedCode };
      setStocktakeScannedItem(updatedItem);
      setStocktakeCountedQty(updatedItem.stock || 0);
    } catch (err: any) {
      console.error(err);
      notify.error(`❌ فشل ربط الكود بالمنتج: ${err.message}`);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setName(item.name || '');
    setCode(item.code || '');
    setPrice(item.price || 0);
    setPurchasePrice(item.purchasePrice || 0);
    setStock(item.stock || 0);
    setMinStock(item.minStock || 5);
    setUnit(item.unit || 'قطعة');
    setItemCategory(item.category || categories.filter(c => c !== 'الكل')?.[0] || 'عام');
    setImageUrl(item.imageUrl || '');
    setCurrency(item.currency || 'YER');
    setIsModalOpen(true);
  };

  const handleDelete = async (item: any) => {
    const confirmDel = await confirm({
      title: 'حذف صنف من المخزون',
      message: `هل أنت متأكد تماماً من شطب وحذف الصنف "${item.name}" من مخزون الكاشير؟`,
      isDanger: true,
      confirmText: 'نعم، احذفه',
      cancelText: 'تراجع'
    });
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'items', item.id));
      notify.success('🗑️ تم شطب المنتج بنجاح.');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ أثناء محاولة شطب السجل.');
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    const toastId = notify.loading('جاري ضغط ورفع صورة المنتج للمخازن...');

    try {
      const uploadResult = await uploadItemImage(file, 'item_product_images');
      if (uploadResult) {
        setImageUrl(uploadResult);
        notify.success('تمت إضافة الصورة بنجاح! 🖼️');
      } else {
        throw new Error('فشلت معالجة الصورة.');
      }
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'خطأ في رفع صورة الصنف.');
    } finally {
      notify.dismiss(toastId);
      setImageUploading(false);
    }
  };

  // Run serverless Gemini AI Categorizer
  const runAICategorizeSuggestion = async () => {
    if (!name.trim()) {
      notify.error('الرجاء كتابة اسم الصنف أولاً ليقوم الذكاء الاصطناعي بتحليله.');
      return;
    }

    setAiCategorizing(true);
    notify.info('جاري تشغيل معالج الذكاء الاصطناعي لفحص ووصف الصنف بقسيمة العمل...');

    try {
      const suggestedCategoryName = await runGeminiAIProductCategorizer(name.trim());
      if (suggestedCategoryName) {
        setItemCategory(suggestedCategoryName);
        notify.success(`🔮 ذكاء الحسام اقترح بنجاح: "${suggestedCategoryName}"`);
      } else {
        notify.error('لم يتمكن الذكاء الاصطناعي من تحليل الصنف حالياً.');
      }
    } catch (err: any) {
      console.error(err);
      notify.error('فشل في استلام ترشيحات الذكاء الاصطناعي.');
    } finally {
      setAiCategorizing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!name.trim() || Number(price) <= 0) {
      notify.error('الرجاء تدوين اسم المنتج وتحديد سعر البيع للزبون.');
      setSaving(false);
      return;
    }

    const docId = editingItem ? editingItem.id : `item_${Math.floor(Math.random() * 90000) + 10000}`;
    const toastId = notify.loading('جاري حفظ المنتج بالمخازن...');

    try {
      // Unique Code validation
      if (!editingItem && code.trim()) {
        const checkQ = query(collection(db, 'items'), where('code', '==', code.trim()));
        const snap = await getDocs(checkQ);
        if (!snap.empty) {
          notify.dismiss(toastId);
          notify.error('❌ عذراً، باركود المنتج هذا مسجل مسبقاً لصنف آخر!');
          setSaving(false);
          return;
        }
      }

      await setDoc(doc(db, 'items', docId), {
        id: docId,
        name: name.trim(),
        code: code.trim() || '',
        price: Number(price) || 0,
        purchasePrice: Number(purchasePrice) || 0,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        unit: unit.trim(),
        category: itemCategory.trim(),
        imageUrl: imageUrl.trim() || '',
        currency: currency,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      notify.dismiss(toastId);
      notify.success(editingItem ? '✏️ تم حفظ المنتج بنجاح!' : '📦 تم إدراج الصنف الجديد ودورانه بالمخزون بنجاح!');
      setIsModalOpen(false);

      if (!editingItem) {
        fetch('/php-backend/add_item.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_name: name.trim(),
            stock: Number(stock) || 0,
            unit: unit.trim() || 'حبة'
          })
        }).then(res => res.json())
          .then(data => console.log('PHP New Item FCM outcome:', data))
          .catch(err => console.warn('Failed to dispatch PHP New Item FCM notification:', err));
      }
    } catch (err: any) {
      console.error(err);
      notify.dismiss(toastId);
      notify.error(err.message || 'فشلت الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  // CSV export triggered safely in secondary worker threads
  const handleCSVBackgroundDownload = () => {
    if (items.length === 0) {
      notify.error('لا توجد منتجات حالياً بالمخزن لتصديرها.');
      return;
    }

    notify.info('جاري تجميع المخزن وتصدير كشف الصندوق لملف CSV في الخلفية...');
    const headers = ['اسم المنتج', 'رقم الباركود', 'فئة الصنف', 'سعر البيع', 'سعر الشراء', 'الكمية المتوفرة', 'وحدة القياس'];
    const rows = items.map((it: any) => [
      it.name || '',
      it.code || '',
      it.category || '',
      it.price || 0,
      it.purchasePrice || 0,
      it.stock || 0,
      it.unit || 'قطعة'
    ]);

    exportToCSVInBackground(headers, rows, `inventory_sales_sheet_${Date.now()}`);
  };

  // Filter list containing queries
  const filteredItems = items.filter(target => {
    const matchesSearch = (target.name || '').includes(searchQuery) || (target.code || '').includes(searchQuery);
    const matchesCategory = selectedCategory === 'الكل' || target.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsToShow = React.useMemo(() => {
    return filteredItems.slice(0, visibleInventoryLimit);
  }, [filteredItems, visibleInventoryLimit]);

  // Dynamic financial statistics calculations
  const convertToYer = React.useCallback((value: number, curr?: string) => {
    return Number(value) || 0;
  }, []);

  const totalPurchaseValue = items.reduce((acc: number, item: any) => {
    const qty = Number(item.stock) || 0;
    const purchase = Number(item.purchasePrice) || 0;
    const convertedPurchase = convertToYer(purchase, item.currency);
    return acc + (qty * convertedPurchase);
  }, 0);

  const totalSaleValue = items.reduce((acc: number, item: any) => {
    const qty = Number(item.stock) || 0;
    const sale = Number(item.price) || 0;
    const convertedSale = convertToYer(sale, item.currency);
    return acc + (qty * convertedSale);
  }, 0);

  const expectedProfit = totalSaleValue - totalPurchaseValue;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(val)) + ' ر.ي';
  };

  return (
    <div className="space-y-6 text-right pb-20 md:pb-6" dir="rtl">
      
      {/* Title */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
               <Package className="w-6 h-6" />
            </div>
            <div className="text-right">
               <h1 className="text-xl font-black text-gray-900 dark:text-white">إدارة مخازن المنتجات والواردات</h1>
               <p className="text-xs text-gray-500 font-bold mt-0.5">تسجيل الأصناف الواردة، تتبع مستويات الإمداد، وإدراج المنتجات ديناميكياً</p>
            </div>
         </div>

         <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto print:hidden">
            <button 
              onClick={() => setIsWidgetOpen(!isWidgetOpen)}
              className="px-3 py-2.5 bg-gradient-to-r from-amber-500 to-[#8B5E3C] hover:from-amber-600 hover:to-[#734A2E] text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border-none w-full"
              id="toggle-ai-widget-btn"
            >
               <Sparkles className="w-3.5 h-3.5 text-yellow-250 animate-pulse shrink-0" />
               <span className="truncate">المساعد الذكي</span>
            </button>

            <button
               onClick={handleCSVBackgroundDownload}
               className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150/10 dark:bg-slate-800 dark:hover:bg-slate-750 text-secondary dark:text-gray-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer w-full text-center"
            >
               <FileInput className="w-3.5 h-3.5 shrink-0" />
               <span className="truncate">تصدير CSV</span>
            </button>

            <button 
              onClick={() => setIsStocktakeOpen(true)}
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border-none w-full"
              id="open-camera-stocktake-btn"
            >
               <Camera className="w-3.5 h-3.5 animate-pulse shrink-0" />
               <span className="truncate">جرد الكاميرا</span>
            </button>

            <button 
              onClick={openAddModal}
               className="btn-primary text-[11px] font-black px-3 py-2.5 rounded-xl cursor-pointer border-none shadow-xs w-full flex items-center justify-center gap-1.5"
              id="add-new-item-btn"
            >
               <Plus className="w-4 h-4 shrink-0" />
               <span className="truncate">قيد صنف جديد</span>
            </button>
         </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        {/* Total Purchase Value (Cost) */}
        <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
             <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 block">إجمالي قيمة المخزون (شراء)</span>
             <h2 className="text-xl sm:text-2xl font-black text-[#8B5E3C] dark:text-amber-500 font-mono tracking-tight">
               {formatCurrency(totalPurchaseValue)}
             </h2>
             <span className="text-[9px] text-[#8B5E3C]/80 dark:text-amber-500/80 font-bold block">مجموع التكلفة الفعلية للأصناف</span>
          </div>
          <div className="w-12 h-12 bg-[#8B5E3C]/10 rounded-xl flex items-center justify-center text-[#8B5E3C] dark:text-amber-500 shrink-0 shadow-xs">
             <Package className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Expected Net Profit */}
        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-650/5 dark:from-slate-900 dark:to-slate-900/40 border border-emerald-550/15 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
             <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 block">صافي الأرباح المتوقعة</span>
             <h2 className="text-xl sm:text-2xl font-black text-emerald-650 dark:text-emerald-400 font-mono tracking-tight">
               {formatCurrency(expectedProfit)}
             </h2>
             <span className="text-[9px] text-emerald-600 dark:text-emerald-400/80 font-bold block">العائد الصافي بعد بيع المخزون</span>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
             <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Sale Value */}
        <div className="bg-gradient-to-br from-amber-500/5 to-[#8B5E3C]/5 dark:from-slate-900 dark:to-slate-900/40 border border-[#8B5E3C]/15 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
             <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 block">إجمالي قيمة المخزن (بيع)</span>
             <h2 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-500 font-mono tracking-tight">
               {formatCurrency(totalSaleValue)}
             </h2>
             <span className="text-[9px] text-amber-550 dark:text-amber-500/80 font-bold block">القيمة السوقية الكلية المعروضة للزبائن</span>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-500 shrink-0 shadow-xs">
             <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* AI Ingestion Widget Card */}
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-5 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-slate-850 rounded-2xl border-2 border-[#8B5E3C]/30 dark:border-[#8B5E3C]/50 shadow-md space-y-4 text-right"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-[#8B5E3C] rounded-lg flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                    المساعد الذكي للإدخال السريع <span className="text-[10px] bg-[#E2A85C]/10 text-[#8B5E3C] dark:text-amber-400 px-2 py-0.5 rounded-md">Gemini AI</span>
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">ارفع صورة قائمة المنتجات أو ملف PDF أو الصق الفاتورة وسيتم استخراج وحقن الأصناف تلقائياً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWidgetOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-400 border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Assistant Mode Tabs */}
            <div className="flex border-b border-gray-150/60 dark:border-slate-800/80 gap-2 pb-1" dir="rtl">
              <button
                type="button"
                onClick={() => setActiveAITab('direct')}
                className={`py-2.5 px-4 rounded-t-xl text-xs font-bold transition-all border-none cursor-pointer ${
                  activeAITab === 'direct'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold'
                    : 'bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                📥 الحقن التلقائي الذكي المباشر
              </button>
              <button
                type="button"
                onClick={() => setActiveAITab('interactive')}
                className={`py-2.5 px-4 rounded-t-xl text-xs font-bold transition-all border-none cursor-pointer ${
                  activeAITab === 'interactive'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold'
                    : 'bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                📊 الاستخراج التفاعلي والمراجعة قبل الحقن
              </button>
            </div>

            {activeAITab === 'direct' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Drag and Drop Zone */}
                  <div className="space-y-2">
                    <label className="text-[10.5px] font-bold text-[#8B5E3C] dark:text-amber-400 block mr-1">رفع قائمة الأصناف (فواتير، كشوفات):</label>
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[160px] ${
                        dragActive 
                          ? 'border-[#E2A85C] bg-[#8B5E3C]/10' 
                          : 'border-gray-250 dark:border-slate-750 hover:border-[#8B5E3C] hover:bg-amber-50/5'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAiIngestFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      {aiIngestFile ? (
                        <div className="text-center space-y-2 select-none" onClick={(e) => e.stopPropagation()}>
                          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-450 rounded-xl flex items-center justify-center mx-auto shadow-xs">
                            {aiIngestFile.type === 'application/pdf' ? (
                              <span className="text-[10px] font-black font-mono">PDF</span>
                            ) : (
                              <ImageIcon className="w-6 h-6" />
                            )}
                          </div>
                          <p className="text-[10px] font-black text-gray-800 dark:text-gray-200 line-clamp-1 max-w-[200px]">{aiIngestFile.name}</p>
                          <p className="text-[9px] text-gray-400 font-mono">({(aiIngestFile.size / 1024).toFixed(1)} KB)</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAiIngestFile(null);
                            }}
                            className="px-2.5 py-1 bg-red-50 text-red-650 hover:bg-red-100 rounded-lg text-[9px] font-bold border-none cursor-pointer"
                          >
                            إلغاء الملف 🗑️
                          </button>
                        </div>
                      ) : (
                        <div className="text-center space-y-1 text-gray-450 select-none">
                          <Upload className="w-8 h-8 mx-auto text-[#8B5E3C] opacity-70 animate-bounce" />
                          <p className="text-[11px] font-black text-gray-700 dark:text-gray-300">اسحب وأفلت الفاتورة هنا، أو انقر للتصفح</p>
                          <p className="text-[9.5px] text-gray-400">يدعم الصور (PNG, JPG) ومستندات PDF</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text Area Description */}
                  <div className="space-y-2">
                    <label className="text-[10.5px] font-bold text-[#8B5E3C] dark:text-amber-400 block mr-1">أو الصق نص الفاتورة يدوياً:</label>
                    <textarea
                      value={aiIngestText}
                      onChange={(e) => setAiIngestText(e.target.value)}
                      placeholder="مثال:&#10;شاحن أنكر قماش بقوة 20 واط عدد 15 حبة سعر الشراء 35 ريال وسعر البيع 75 ريال&#10;كبل آيفون قماشي عدد 10 حبات سعر الشراء 12 ريال وسعر البيع 35 ريال..."
                      className="w-full h-[160px] p-3 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary text-right font-sans text-gray-950 dark:text-gray-50 resize-none font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* Ingest Action Button & Progress Indicator */}
                <div className="pt-3 border-t border-gray-150/50 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleAIInjest}
                    disabled={aiIngestLoading}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-[#8B5E3C] hover:from-amber-600 hover:to-[#734A2E] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 border-none shadow-md cursor-pointer hover:scale-[1.01] transition-all"
                  >
                    {aiIngestLoading ? (
                      <>
                        <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                        جاري التحليل واستخراج المنتجات...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4.5 h-4.5 text-yellow-250 animate-pulse" />
                        استخراج وحقن الأصناف بالذكاء الاصطناعي
                      </>
                    )}
                  </button>

                  {aiIngestLoading && (
                    <div className="w-full flex-1 max-w-md space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-right" dir="rtl">
                        <span className="text-primary italic animate-pulse">{aiIngestStatus}</span>
                        <span className="text-[#8B5E3C]">{aiIngestProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-850 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${aiIngestProgress}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-gradient-to-r from-[#E2A85C] to-[#8B5E3C]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-1 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                <AIParsing onItemsImported={handleImportFromAIParsing} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl p-3 shadow-xs items-center">
         
         <div className="relative sm:col-span-8">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث بقسيمة الاسم أو رقم الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-12 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary text-right text-gray-950 dark:text-gray-50"
            />
            {/* Camera Floating toggle trigger in Search bar */}
            <button
               onClick={() => setIsScannerOpen(true)}
               className="p-1.5 bg-primary rounded-lg text-white absolute left-2 top-1/2 -translate-y-1/2 hover:scale-105 transition-transform cursor-pointer border-none"
               title="تشغيل ماسح ومثبت الكرت باركود بالكاميرا"
               id="search-barcode-camera-btn"
            >
               <Barcode className="w-4.5 h-4.5" />
            </button>
         </div>

         {/* Categories switch */}
         <div className="sm:col-span-4 select-none">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer text-gray-950 dark:text-gray-50"
            >
               {categories.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
               ))}
            </select>
         </div>

      </div>

      {loading && items.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-bold">جاري موازنة وتثبيت قائمة المخزون...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400 font-bold">
           <Package className="w-8 h-8 opacity-40 text-[#8B5E3C]" />
           <p className="text-sm">لم يتقيد أي صنف مخزني يطابق المرشحات الملقاة حالياً</p>
        </div>
      ) : (
        /* Inventory Table Lists representation */
        <div className="bg-surface rounded-2xl border border-gray-155 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="overflow-x-auto text-right" dir="rtl">
              <table className="w-full text-right divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                 <thead className="bg-gray-50 dark:bg-slate-800/15 font-bold text-gray-500">
                    <tr>
                       <th className="p-4 pr-6">المنتج والباركود</th>
                       <th className="p-4">الفئة المحتضنة</th>
                       <th className="p-4 text-center">تكلفة الشراء</th>
                       <th className="p-4 text-center">سعر البيع المقيد</th>
                       <th className="p-4 text-center">مستوى المخزن</th>
                       <th className="p-4 pl-6 text-left">تحديث</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-foreground">
                    {itemsToShow.map((item) => {
                      const isLow = item.stock <= (item.minStock || 5);
                      return (
                       <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-850/10 transition-colors">
                          <td className="p-4 pr-6">
                             <div className="flex items-center gap-3">
                                {/* Compressed thumbnail loader safety layout icon representation */}
                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-150 dark:border-slate-800 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                                   <ProductImage src={item.imageUrl} alt={item.name} category={item.category} />
                                </div>
                                <div className="min-w-0 text-right">
                                   <p className="text-xs font-black line-clamp-1 truncate">{item.name}</p>
                                   <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono mt-0.5">
                                      <Barcode className="w-3 h-3 text-[#3D2B1F]" />
                                      <span>{item.code || 'بلا باركود'}</span>
                                   </div>
                                </div>
                             </div>
                          </td>
                          <td className="p-4">
                             <span className="px-2.5 py-1 bg-[#8B5E3C]/10 text-secondary rounded-lg font-black text-[9px]">
                                {item.category}
                             </span>
                          </td>
                          <td className="p-4 text-center font-bold font-mono text-gray-550 border-r border-gray-100/30">
                             {item.purchasePrice !== undefined && item.purchasePrice !== null ? `${item.purchasePrice.toLocaleString()} ${getCurrencySymbol(item.currency)}` : 'غير مدون'}
                          </td>
                          <td className="p-4 text-center font-black font-mono text-primary dark:text-amber-500">
                             {(item.price || 0).toLocaleString()} {getCurrencySymbol(item.currency)}
                          </td>
                          <td className="p-4 border-l border-gray-100/30">
                             <div className="flex flex-col items-center justify-center gap-1">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold flex items-center gap-1 shrink-0 ${
                                  isLow ? 'bg-red-50 text-red-650 animate-pulse' : 'bg-emerald-50 text-emerald-650'
                                }`}>
                                   {isLow && <AlertTriangle className="w-3 h-3 inline" />}
                                   {item.stock} {item.unit}
                                </span>
                                {isLow && (
                                   <span className="text-[8px] text-red-500 font-bold">باقي الحد: {item.minStock || 5}</span>
                                )}
                             </div>
                          </td>
                          <td className="p-4 pl-6 text-left shrink-0">
                             <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary border-none cursor-pointer"
                                  title="تحديث المنتج"
                                >
                                   <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg border-none cursor-pointer"
                                  title="حذف وحذف"
                                >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
            {filteredItems.length > visibleInventoryLimit && (
               <div className="p-4 border-t border-gray-100 dark:border-slate-800 text-center bg-surface">
                  <button
                    type="button"
                    id="load-more-inventory-btn"
                    onClick={() => setVisibleInventoryLimit((prev) => prev + 30)}
                    className="px-5 py-2 bg-[#8B5E3C]/10 hover:bg-[#8B5E3C]/15 dark:bg-amber-500/10 dark:hover:bg-amber-500/15 text-primary text-xs font-black rounded-xl transition-all cursor-pointer border border-[#8B5E3C]/20 inline-flex items-center gap-1.5 animate-fadeIn"
                  >
                     <span>عرض المزيد من الأصناف ({filteredItems.length - visibleInventoryLimit} صنف متبقي)</span>
                     <span>🚀</span>
                  </button>
               </div>
            )}
         </div>
       )}

       {/* Item creation / editing drawers */}
       <AnimatePresence>
         {isModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/50" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 p-5 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
                 
                 <h3 className="font-black text-sm text-primary flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {editingItem ? 'تحديث ومراجعة قسيمة الصنف' : 'إدراج صنف وارد جديد ودورانه'}
                 </h3>

                 <form onSubmit={handleSave} className="space-y-4 text-right">
                   
                   <div className="space-y-1 text-right">
                      <label className="text-[10px] font-bold text-gray-500 block mr-1">اسم المنتج والملحق الكامل:</label>
                      <input
                        type="text"
                        required
                        placeholder="جوال ردمي نوت 13 برو 256GB"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary text-right text-gray-950 dark:text-gray-50"
                      />
                   </div>

                   {/* AI suggestions selector directly embedded in form */}
                   <div className="flex bg-slate-50 dark:bg-slate-950/20 p-2 border border-dashed border-primary/20 rounded-xl gap-2 items-center text-right select-none">
                      <span className="text-[9.5px] font-black text-primary">🔮 ذكاء الحسام الآلي ومزامنة الفئات تلقائياً:</span>
                      <button
                        type="button"
                        disabled={aiCategorizing}
                        onClick={runAICategorizeSuggestion}
                        className="bg-primary hover:bg-opacity-90 disabled:opacity-50 text-[9px] text-white px-2.5 py-1 rounded-lg font-black shrink-0 border-none cursor-pointer"
                        id="auto-cat-suggestions-btn"
                      >
                         {aiCategorizing ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : 'فحص وتصنيف الصنف'}
                      </button>
                   </div>

                   <div className="grid grid-cols-2 gap-3 pb-1">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">رقم الباركود (Barcode):</label>
                         <div className="relative">
                            <input
                              type="text"
                              placeholder="أدخل الباركود أو ولد عشوائياً"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              className="w-full pr-3 pl-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-left font-mono outline-none text-gray-950 dark:text-gray-50 text-left"
                            />
                            {/* Barcode scan mini camera trigger directly in code input drawer form */}
                            <button
                              type="button"
                              onClick={() => setIsScannerOpen(true)}
                              className="p-1.5 bg-gray-50 dark:bg-slate-700 text-gray-650 dark:text-gray-300 rounded-lg absolute left-1 top-1/2 -translate-y-1/2 hover:scale-105 transition-transform cursor-pointer border-none"
                              id="item-barcode-capture-btn"
                            >
                               <Camera className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">فئة ومجموعات الصنف:</label>
                         <select
                           value={itemCategory}
                           onChange={(e) => setItemCategory(e.target.value)}
                           className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-sans text-right outline-none cursor-pointer text-gray-950 dark:text-gray-50"
                         >
                            {categories.filter(c => c !== 'الكل').map((c, i) => (
                               <option key={i} value={c}>{c}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 pb-1 text-right">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">تكلفة الشراء الكلية:</label>
                         <input
                           type="number"
                           required
                           placeholder="0"
                           step="any"
                           value={purchasePrice}
                           onChange={(e) => setPurchasePrice(e.target.value)}
                           className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-gray-950 dark:text-gray-50"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">سعر البيع للزبون:</label>
                         <input
                           type="number"
                           required
                           placeholder="0"
                           step="any"
                           value={price}
                           onChange={(e) => setPrice(e.target.value)}
                           className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-gray-950 dark:text-gray-50"
                         />
                      </div>

                      
                   </div>

                   <div className="grid grid-cols-3 gap-2 pb-1">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">الكمية المسجلة:</label>
                         <input
                           type="number"
                           required
                           placeholder="15"
                           step="any"
                           value={stock}
                           onChange={(e) => setStock(e.target.value)}
                           className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-gray-950 dark:text-gray-50"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-500 block mr-1">الحد الأدنى للتنبيه:</label>
                         <input
                           type="number"
                           required
                           placeholder="5"
                           step="any"
                           value={minStock}
                           onChange={(e) => setMinStock(e.target.value)}
                           className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-left outline-none text-gray-950 dark:text-gray-50"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-450 block mr-1">وحدة القياس:</label>
                         <input
                           type="text"
                           required
                           placeholder="قطعة"
                           value={unit}
                           onChange={(e) => setUnit(e.target.value)}
                           className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-right text-gray-950 dark:text-gray-50"
                         />
                      </div>
                   </div>

                   {/* Upload Product Image sandbox representation */}
                   <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl flex items-center gap-4 relative overflow-hidden">
                      <div className="w-16 h-16 rounded-xl bg-white border border-gray-150 overflow-hidden flex items-center justify-center shrink-0">
                         <ProductImage src={imageUrl} alt='Preview' category={itemCategory} />

                         {imageUploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                               <RefreshCw className="w-4 h-4 text-white animate-spin" />
                            </div>
                         )}
                      </div>

                      <div className="space-y-1 text-right flex-1 select-none z-10">
                         <h4 className="text-[10px] font-black text-primary">رفع أو التقاط صورة الصنف</h4>
                         <p className="text-[8.5px] text-gray-400">يثبت الرقابة ويسرع الفرز في كتل الكاشير.</p>
                         <label className="inline-block bg-white border border-gray-200 hover:border-primary px-3 py-1.5 rounded-lg text-primary text-[9px] font-black transition-all cursor-pointer">
                            اختر صورة المنتج 📸
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleImageSelect} 
                              className="hidden" 
                              disabled={imageUploading}
                            />
                         </label>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                      <button type="submit" disabled={saving} className="w-full btn-primary text-xs font-black py-2.5 justify-center cursor-pointer border-none shadow-sm">
                         {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                         <span>تقييد المنتج وحفظه</span>
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner popup camera */}
      <AnimatePresence>
         {isScannerOpen && (
            <BarcodeScanner 
              onScan={(scannedVal) => {
                 setCode(scannedVal);
                 setSearchQuery(scannedVal);
                 notify.success(`تم قراءة الباركود بنجاح: ${scannedVal} 🎉`);
              }} 
              onClose={() => setIsScannerOpen(false)} 
            />
         )}
      </AnimatePresence>

      {/* Quick Stocktake (الجرد السريع عبر الكاميرا) dialog */}
      <AnimatePresence>
        {isStocktakeOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
             >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                   <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-xs">
                         <Camera className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                         <h3 className="font-black text-gray-950 dark:text-white text-sm font-sans">{t('الجرد السريع والتدقيق الميداني بالكاميرا 📸')}</h3>
                         <p className="text-[10px] text-gray-400 font-bold font-sans">{t('تحديث كميات مستويات الإمداد وتدقيق المنتجات لحظياً في Firestore')}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setIsStocktakeOpen(false)} 
                     className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
                   >
                      <X className="w-5 h-5 text-gray-400" />
                   </button>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right" dir="rtl">
                   
                   {/* Scanning controls */}
                   <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-right">
                         <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 block font-sans">{t('اختر وضع معالجة الجرد:')}</span>
                         <p className="text-[10.5px] text-gray-400 font-bold font-sans">{t('تراكمي (+1) بالكامل بمسحة واحدة أو مراجعة يدوية وتخصيص التفاصيل والأرقام.')}</p>
                      </div>

                      <div className="flex items-center gap-2 select-none">
                         <button
                           type="button"
                           onClick={() => setStocktakeMode('manual')}
                           className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all border ${
                              stocktakeMode === 'manual'
                               ? 'bg-white dark:bg-slate-850 border-emerald-555 text-emerald-600 shadow-xs'
                                : 'bg-transparent border-gray-200 dark:border-slate-800 text-gray-400'
                           }`}
                         >
                            {t('مراجعة وتعديل كميات ✏️')}
                         </button>
                         <button
                           type="button"
                           onClick={() => setStocktakeMode('auto')}
                           className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all border ${
                              stocktakeMode === 'auto'
                               ? 'bg-white dark:bg-slate-850 border-emerald-555 text-emerald-600 shadow-xs'
                                : 'bg-transparent border-gray-200 dark:border-slate-800 text-gray-400'
                           }`}
                         >
                            {t('مسح تراكمي فوري (+1) ⚡')}
                         </button>
                      </div>
                   </div>

                   {/* Main Action Scan button */}
                   <div className="text-center py-4 bg-gray-50/50 dark:bg-slate-850/20 border border-dashed border-gray-205 dark:border-slate-800 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setIsStocktakeScannerOpen(true)}
                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2.5 mx-auto hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none shadow-md shadow-emerald-600/10"
                      >
                         <Camera className="w-5 h-5 animate-bounce" />
                         <span>{t('اضغط لتشغيل الكاميرا ومسح الباركود الجديد 📸')}</span>
                      </button>
                      {stocktakeScannedCode ? (
                         <div className="mt-3 text-xs font-mono font-bold text-gray-400">
                            {t('الرمز الأخير المسحوب:')} <span className="text-emerald-600 dark:text-emerald-450 font-black">{stocktakeScannedCode}</span>
                         </div>
                      ) : (
                         <p className="mt-2 text-[10.5px] text-gray-400 font-bold">{t('وجه الهاتف نحو باركود السلعة ليتم جلبه لحظياً')}</p>
                      )}
                   </div>

                   {/* Current Scanned Product Representation */}
                   {stocktakeScannedCode && (
                      <div className="border border-gray-150 dark:border-slate-800 rounded-2xl p-5 space-y-4 animate-fade-in bg-white dark:bg-slate-900/40">
                         {stocktakeScannedItem ? (
                            <div className="space-y-4">
                               <div className="flex gap-4 items-start justify-between border-b border-gray-100 dark:border-slate-850 pb-4">
                                  <div className="flex gap-3">
                                     <div className="w-16 h-16 rounded-xl bg-gray-50/50 dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-800">
                                        <ProductImage src={stocktakeScannedItem.imageUrl} alt={stocktakeScannedItem.name} category={stocktakeScannedItem.category} />
                                     </div>
                                     <div className="space-y-1 text-right">
                                        <span className="px-2 py-0.5 bg-gray-150/50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-black rounded font-sans">
                                           {stocktakeScannedItem.category || 'عام'}
                                        </span>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white leading-tight font-sans">{stocktakeScannedItem.name}</h4>
                                        <p className="text-[10px] font-mono text-gray-450 font-black">الباركود: {stocktakeScannedItem.code}</p>
                                        <p className="text-[10px] font-sans font-bold text-gray-400">
                                           سعر البيع المعزز: <span className="font-mono text-[#8B5E3C]">{stocktakeScannedItem.price} {getCurrencySymbol(stocktakeScannedItem.currency)}</span>
                                        </p>
                                     </div>
                                  </div>
                                  <div className="text-left">
                                     <span className="text-[10px] font-bold text-gray-400 block font-sans">الكمية الحالية بالمخزون</span>
                                     <span className="text-xl font-black text-gray-800 dark:text-gray-200 font-mono inline-block mt-1">
                                        {stocktakeScannedItem.stock} {stocktakeScannedItem.unit || 'قطعة'}
                                     </span>
                                  </div>
                               </div>

                               {stocktakeMode === 'manual' ? (
                                  <div className="space-y-3 bg-gray-50/40 dark:bg-slate-850/30 p-4 rounded-xl border border-gray-100 dark:border-slate-850">
                                     <span className="text-xs font-black text-gray-700 dark:text-gray-300 block font-sans">✏️ جرد وتخصيص مستويات الكمية الفعلية:</span>
                                     <div className="flex items-center gap-3 justify-start">
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-205 dark:border-slate-700 rounded-xl px-2.5 py-1">
                                           <button 
                                             type="button" 
                                             onClick={() => setStocktakeCountedQty(prev => Math.max(0, Number(prev) - 1))}
                                             className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-750 dark:hover:bg-slate-705 flex items-center justify-center font-black text-gray-600 dark:text-gray-300 border-none cursor-pointer"
                                           >
                                              -
                                           </button>
                                           <input
                                             type="number"
                                             step="any"
                                             value={stocktakeCountedQty}
                                             onChange={(e) => setStocktakeCountedQty(e.target.value)}
                                             className="w-20 text-center font-mono font-black text-sm bg-transparent border-none outline-none text-gray-950 dark:text-gray-50"
                                           />
                                           <button 
                                             type="button" 
                                             onClick={() => setStocktakeCountedQty(prev => Number(prev) + 1)}
                                             className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-750 dark:hover:bg-slate-705 flex items-center justify-center font-black text-gray-600 dark:text-gray-300 border-none cursor-pointer"
                                           >
                                              +
                                           </button>
                                        </div>
                                        <span className="text-xs text-gray-400 font-bold font-sans">({stocktakeScannedItem.unit || 'قطعة'}) تم عدّها في الرفوف</span>
                                     </div>

                                     <div className="flex justify-end gap-2 pt-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                             setStocktakeScannedItem(null);
                                             setStocktakeScannedCode('');
                                          }}
                                          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-250 dark:bg-slate-800 text-gray-550 rounded-lg text-xs font-bold transition-all cursor-pointer border-none"
                                        >
                                           تخطي
                                        </button>
                                        <button
                                          type="button"
                                          onClick={submitManualStocktake}
                                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs transition-all cursor-pointer border-none shadow-xs flex items-center gap-1.5"
                                        >
                                           <Check className="w-3.5 h-3.5" />
                                           تحديث وتثبيت الجرد الحالي
                                        </button>
                                     </div>
                                  </div>
                               ) : (
                                  <div className="text-center py-2 text-xs font-black text-emerald-600 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                     ⚡ تم إدراج كمية (+{stocktakeAutoAmount}) للتعديل التراكمي في الفايرستور تلقائياً بنجاح!
                                  </div>
                               )}
                            </div>
                         ) : (
                            <div className="space-y-4">
                               <div className="flex items-center gap-3 text-amber-600">
                                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500 animate-pulse" />
                                  <div className="text-right">
                                     <h4 className="text-sm font-black font-sans">الباركود المسحوب ({stocktakeScannedCode}) غير مسجل!</h4>
                                     <p className="text-[10.5px] text-gray-400 font-bold font-sans">لا توجد سلعة مسجلة بهذا الباركود في مخازنك حالياً.</p>
                                  </div>
                               </div>

                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                  {/* Action 1: Register brand new */}
                                  <div className="bg-gray-50 dark:bg-slate-850 p-4 rounded-xl border border-gray-150/40 dark:border-slate-800 flex flex-col justify-between space-y-3">
                                     <p className="text-[10.5px] text-gray-400 font-bold leading-relaxed font-sans">قم بتسجيل منتج جديد بالكامل بمخازنك وتخصيص الباركود {stocktakeScannedCode} له مباشرة.</p>
                                     <button
                                       type="button"
                                       onClick={() => {
                                          openAddModalWithCode(stocktakeScannedCode);
                                          setIsStocktakeOpen(false);
                                       }}
                                       className="w-full py-2 bg-[#E2A85C] hover:opacity-95 text-white font-black text-xs rounded-lg cursor-pointer border-none shadow-xs text-center block font-sans"
                                     >
                                        ➕ إضافة كمنتج جديد بمخازنك
                                     </button>
                                  </div>

                                  {/* Action 2: Link to existing */}
                                  <div className="bg-gray-50 dark:bg-slate-850 p-4 rounded-xl border border-gray-150/40 dark:border-slate-800 flex flex-col justify-between space-y-3">
                                     <p className="text-[10.5px] text-gray-400 font-bold leading-relaxed font-sans">اربط هذا الباركود بمنتج مسجل مسبقاً في مخازنك لا يمتلك كود تفريغي.</p>
                                     <div className="space-y-2">
                                        <input
                                          type="text"
                                          placeholder="ابحث بالاسم لتحديده وربط الكود..."
                                          value={linkingSearchQuery}
                                          onChange={(e) => setLinkingSearchQuery(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-250 dark:border-slate-700 rounded-lg text-[11px] font-bold outline-none text-right placeholder:text-gray-400"
                                        />
                                        
                                        {linkingSearchQuery.trim().length > 1 && (
                                           <div className="max-h-24 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-1 space-y-1">
                                              {items
                                                .filter((it: any) => !it.code && it.name.toLowerCase().includes(linkingSearchQuery.toLowerCase()))
                                                .slice(0, 4)
                                                .map((it: any) => (
                                                   <button
                                                     key={it.id}
                                                     type="button"
                                                     onClick={() => handleLinkBarcode(it)}
                                                     className="w-full text-right text-[10.5px] p-1.5 hover:bg-gray-50 dark:hover:bg-slate-850 rounded font-sans font-bold flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer text-gray-800 dark:text-gray-200"
                                                   >
                                                      <span>{it.name}</span>
                                                      <span className="text-[9px] text-gray-400">({it.stock} حبة)</span>
                                                   </button>
                                                ))}
                                              {items.filter((it: any) => !it.code && it.name.toLowerCase().includes(linkingSearchQuery.toLowerCase())).length === 0 && (
                                                 <p className="text-[9px] text-gray-400 text-center py-1">لا توجد منتجات بدون باركود متبقية تبدأ بهذا الاسم.</p>
                                              )}
                                           </div>
                                        )}
                                     </div>
                                  </div>
                               </div>
                            </div>
                         )}
                      </div>
                   )}

                   {/* Session Stocktake History Log */}
                   <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-black text-gray-400 block tracking-wider font-sans uppercase">سجل المجرودات والمستويات المحدثة في هذه الجلسة ({stocktakeHistory.length}):</span>
                      <div className="max-h-[160px] overflow-y-auto border border-gray-150/40 dark:border-slate-800 p-3 rounded-2xl bg-gray-50/30 dark:bg-slate-900/40 space-y-2">
                         {stocktakeHistory.map((hist, i) => (
                            <div key={i} className="flex justify-between items-center text-xs border-b border-gray-100/50 dark:border-slate-800 pb-2">
                               <div className="text-right">
                                  <p className="font-extrabold text-gray-800 dark:text-gray-250 font-sans">{hist.name}</p>
                                  <p className="text-[9px] text-gray-400 font-mono">الباركود: {hist.code} | {hist.timestamp}</p>
                               </div>
                               <div className="text-left font-mono font-bold flex items-center gap-1.5">
                                  <span className="text-gray-450 line-through">{hist.previousStock}</span>
                                  <span className="text-gray-400">←</span>
                                  <span className="text-emerald-650 dark:text-emerald-400">{hist.newStock} حبة</span>
                               </div>
                            </div>
                         ))}
                         {stocktakeHistory.length === 0 && (
                            <p className="text-[10px] text-gray-400 text-center py-4 font-sans font-bold">لم يتم جرد أي مواد خلال جلسة العمل الحالية بعد.</p>
                         )}
                      </div>
                   </div>

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between pr-6 font-sans">
                   <div className="text-right flex items-center text-[10px] text-gray-400 font-bold">
                      💡 تتكامل مستويات المخزون الجديدة وتتحدث تلقائياً بجميع الشاشات وصناديق الحساب.
                   </div>
                   <button
                     type="button"
                     onClick={() => setIsStocktakeOpen(false)}
                     className="px-5 py-2.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl hover:bg-gray-300 transition-colors border-none cursor-pointer"
                   >
                      إغلاق نافذة الجرد
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner popup for Stocktaking */}
      <AnimatePresence>
         {isStocktakeScannerOpen && (
            <BarcodeScanner 
              onScan={(scannedVal) => handleStocktakeScan(scannedVal)} 
              onClose={() => setIsStocktakeScannerOpen(false)} 
            />
         )}
      </AnimatePresence>

    </div>
  );
}
