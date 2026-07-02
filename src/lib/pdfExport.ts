import { notify } from './notifications';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';

/**
 * Helper to dynamically draw a professional invoice on a high-DPI Canvas
 */
export const drawInvoiceOnCanvas = async (invoice: any, shopSettings: any): Promise<HTMLCanvasElement> => {
  // Wait for all fonts in the document to be fully loaded and ready before drawing on canvas
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get Canvas 2D context');

  const items = invoice.items || [];
  const invoiceCurrency = invoice.currency || 'YER';
  const getCurrencySymbol = (currencyCode: string | undefined): string => {
    return 'ر.ي';
  };
  const currencySymbol = getCurrencySymbol(invoiceCurrency);

  const primaryColor = shopSettings?.primaryColor || '#541919';
  const secondaryColor = shopSettings?.secondaryColor || '#B3803E';

  // Constants for dimensions and layout details
  const scale = 2; // For Retina-level crispness
  const width = 800;
  
  // Calculate heights dynamically
  const itemHeight = 50;
  const headerHeight = 220;
  const detailsHeight = 110;
  const tableHeaderHeight = 45;
  const tableHeight = items.length * itemHeight;
  
  // Dynamic heights for totals and notes footer
  const discountVal = Number(invoice.discount) || 0;
  const subtotalVal = Number(invoice.subtotal) || Number(invoice.total) || 0;
  const totalVal = Number(invoice.total) || 0;
  const totalsBoxHeight = discountVal > 0 ? 100 : 75;
  const totalsHeight = totalsBoxHeight + 35;
  
  const receiptNotes = shopSettings?.receiptNotes || 'شكراً لتعاملكم معنا! البضاعة المباعة لا ترد ولا تستبدل بعد 24 ساعة.';
  const noteLines = receiptNotes.split('\n');
  const notesBoxHeight = noteLines.length * 22 + 25;
  const footerHeight = notesBoxHeight + 80;
  
  const height = headerHeight + detailsHeight + tableHeaderHeight + tableHeight + totalsHeight + footerHeight;

  const centerX = width / 2;
  const centerY = height / 2;

  // Set physical dimensions of canvas to be scale * display dimension
  canvas.width = width * scale;
  canvas.height = height * scale;

  // Scale context to draw crisp vectors
  ctx.scale(scale, scale);

  // Set default styles and clear canvas to pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Enable native browser Arabic shaping and RTL flow
  ctx.direction = 'rtl';

  // --- 1. HEADER SECTION ---
  // Try loading logo
  let logoImg: HTMLImageElement | null = null;
  const logoSource = shopSettings?.logoUrl || defaultAppIcon;
  if (logoSource) {
    logoImg = new Image();
    const isDataOrLocal = logoSource.startsWith('data:') || logoSource.startsWith('/') || logoSource.startsWith('.') || !logoSource.includes('://');
    if (!isDataOrLocal) {
      logoImg.crossOrigin = 'anonymous';
    }
    logoImg.src = logoSource;
    await new Promise((resolve) => {
      if (!logoImg) return resolve(false);
      logoImg.onload = () => resolve(true);
      logoImg.onerror = () => {
        if (logoSource !== defaultAppIcon) {
          logoImg!.removeAttribute('crossOrigin');
          logoImg!.src = defaultAppIcon;
          logoImg!.onload = () => resolve(true);
          logoImg!.onerror = () => resolve(false);
        } else {
          resolve(false);
        }
      };
    });
  }

  // Draw Logo (left aligned)
  if (logoImg && logoImg.complete && logoImg.width > 0) {
    // Canvas drawImage does not depend on text direction. Draw logo at x=50
    ctx.drawImage(logoImg, 50, 40, 100, 100);
  }

  // Draw Shop Name, Phone & Address (right aligned)
  ctx.textAlign = 'right';
  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 30px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(shopSettings?.shopName || 'الحسام فون', 750, 75);

  ctx.fillStyle = '#4b5563';
  ctx.font = '14px "Segoe UI", Tahoma, Arial, sans-serif';
  if (shopSettings?.shopPhone) {
    ctx.fillText(`تلفون: ${shopSettings.shopPhone}`, 750, 105);
  }
  if (shopSettings?.shopAddress) {
    ctx.fillText(shopSettings.shopAddress, 750, 130);
  }

  // Draw Invoice Title Badge
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.roundRect(50, 150, 140, 35, 6);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('فاتورة مبيعات', 120, 172);

  // Draw decorative top line
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, height - 3);
  ctx.lineTo(750, height - 3);
  ctx.stroke();

  // Fine separation line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 200);
  ctx.lineTo(750, 200);
  ctx.stroke();

  // --- BACKGROUND WATERMARK ---
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-45 * Math.PI / 180); // Tilted elegantly by -45 degrees
  ctx.globalAlpha = 0.04; // Extremely faint background watermark (opacity 4%)

  if (logoImg && logoImg.complete && logoImg.width > 0) {
    ctx.drawImage(logoImg, -180, -180, 360, 360); // Large centered logo watermark
  } else {
    // Fallback watermark if logo is unavailable
    ctx.fillStyle = primaryColor;
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText('نظام الحسام فون للمبيعات', 0, 0);
  }
  ctx.restore();

  // --- 2. DETAILS SECTION ---
  // Background Box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(179, 128, 62, 0.15)'; // Golden/amber border
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(50, 215, 700, 80, 8);
  ctx.fill();
  ctx.stroke();

  // Draw a subtle golden vertical strip on the right side of details box
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.roundRect(744, 215, 6, 80, [0, 8, 8, 0]);
  ctx.fill();

  // 4 Columns inside Details block
  ctx.textAlign = 'right';

  // Column 1: Date (Rightmost)
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('التاريخ والوقت', 725, 238);
  
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';

  // High reliability date & time extraction to avoid "Invalid Date"
  let dateObj = new Date();
  if (invoice.date) {
    if (typeof invoice.date === 'string' || typeof invoice.date === 'number') {
      dateObj = new Date(invoice.date);
    } else if (invoice.date.seconds) { // Firebase Timestamp
      dateObj = new Date(invoice.date.seconds * 1000);
    } else if (invoice.date.toDate && typeof invoice.date.toDate === 'function') {
      dateObj = invoice.date.toDate();
    } else if (invoice.date instanceof Date) {
      dateObj = invoice.date;
    }
  }
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  const dateStr = dateObj.toLocaleDateString('ar-YE', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', hour12: true });
  ctx.fillText(`${dateStr} - ${timeStr}`, 725, 268);

  // Column 2: Invoice Number
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('رقم الفاتورة', 545, 238);

  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const invNumberText = invoice.number || invoice.invoiceNumber || invoice.id || 'معلق';
  ctx.fillText(invNumberText, 545, 268);

  // Column 3: Payment Type
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('طريقة الدفع', 365, 238);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';

  // Clean up and display payment modes elegantly
  const rawPaymentType = invoice.paymentType || invoice.paymentMethod || 'cash';
  let cleanPaymentType = 'نقدي (كاش)';
  if (rawPaymentType === 'cash') {
    cleanPaymentType = 'نقدي (كاش) 💵';
  } else if (rawPaymentType === 'debt') {
    cleanPaymentType = 'آجل (دين) 📝';
  } else if (rawPaymentType === 'card' || rawPaymentType === 'network') {
    cleanPaymentType = 'شبكة / بطاقة 💳';
  } else if (typeof rawPaymentType === 'string' && rawPaymentType.toLowerCase().startsWith('wallet:')) {
    cleanPaymentType = `محفظة: ${rawPaymentType.substring(7).trim()}`;
  } else if (rawPaymentType === 'wallet') {
    cleanPaymentType = 'محفظة إلكترونية 📱';
  } else {
    cleanPaymentType = rawPaymentType;
  }
  ctx.fillText(cleanPaymentType, 365, 268);

  // Column 4: Customer (Leftmost)
  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('اسم الزبون / العميل', 185, 238);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(invoice.customer || 'عميل نقدي', 185, 268);


  // --- 3. ITEMS TABLE ---
  const tableStartY = 315;
  
  // Table Header Background with official dark brown
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.roundRect(50, tableStartY, 700, tableHeaderHeight, [8, 8, 0, 0]);
  ctx.fill();

  // Thin golden indicator line below the header
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(50, tableStartY + tableHeaderHeight);
  ctx.lineTo(750, tableStartY + tableHeaderHeight);
  ctx.stroke();

  // Header Titles (White on official primary color)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  
  ctx.textAlign = 'right';
  ctx.fillText('الصنف والمواصفات', 725, tableStartY + 28);
  
  ctx.textAlign = 'center';
  ctx.fillText('الكمية', 380, tableStartY + 28);
  ctx.fillText('سعر الوحدة', 230, tableStartY + 28);
  
  ctx.textAlign = 'left';
  ctx.fillText('الإجمالي الفرعي', 75, tableStartY + 28);

  // Draw Table Rows
  items.forEach((item: any, idx: number) => {
    const rowY = tableStartY + tableHeaderHeight + idx * itemHeight;

    // Zebra striping with faint golden/brown tint
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(179, 128, 62, 0.03)'; // Brand-aligned gold/brown subtle tint
      ctx.fillRect(50, rowY, 700, itemHeight);
    }

    // Border line under row
    ctx.strokeStyle = 'rgba(179, 128, 62, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, rowY + itemHeight);
    ctx.lineTo(750, rowY + itemHeight);
    ctx.stroke();

    // Row Content
    ctx.textAlign = 'right';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(item.name || 'صنف غير معروف', 725, rowY + 31);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText((item.qty || 1).toString(), 380, rowY + 31);
    
    ctx.fillStyle = '#4b5563';
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    const itemPrice = item.price || 0;
    ctx.fillText(`${itemPrice.toLocaleString()} ${currencySymbol}`, 230, rowY + 31);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${((item.qty || 1) * itemPrice).toLocaleString()} ${currencySymbol}`, 75, rowY + 31);
  });

  // --- 4. TOTALS SECTION ---
  const totalsStartY = tableStartY + tableHeaderHeight + (items.length * itemHeight) + 15;

  // Let's draw an elegant totals container on the left side (x: 50, width: 350)
  ctx.fillStyle = 'rgba(179, 128, 62, 0.02)';
  ctx.strokeStyle = 'rgba(179, 128, 62, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(50, totalsStartY, 350, totalsBoxHeight, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';

  if (discountVal > 0) {
    // Row 1: Subtotal
    ctx.fillStyle = '#4b5563';
    ctx.fillText('المجموع الفرعي:', 380, totalsStartY + 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.fillText(`${subtotalVal.toLocaleString()} ${currencySymbol}`, 75, totalsStartY + 30);

    // Row 2: Discount (in red/amber)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b45309'; // Dark amber
    ctx.fillText('الخصم الممنوح:', 380, totalsStartY + 55);
    ctx.textAlign = 'left';
    ctx.fillText(`- ${discountVal.toLocaleString()} ${currencySymbol}`, 75, totalsStartY + 55);

    // Draw separation line
    ctx.strokeStyle = 'rgba(179, 128, 62, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, totalsStartY + 68);
    ctx.lineTo(340, totalsStartY + 68);
    ctx.stroke();

    // Row 3: Grand Total
    ctx.textAlign = 'right';
    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('الصافي النهائي:', 380, totalsStartY + 88);
    ctx.textAlign = 'left';
    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${totalVal.toLocaleString()} ${currencySymbol}`, 75, totalsStartY + 88);
  } else {
    // Simple Grand Total Row
    ctx.fillStyle = secondaryColor;
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('الإجمالي الكلي:', 380, totalsStartY + 45);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${totalVal.toLocaleString()} ${currencySymbol}`, 75, totalsStartY + 45);
  }

  // --- 5. NOTES AND FOOTER ---
  const notesStartY = totalsStartY + totalsBoxHeight + 35;

  ctx.fillStyle = 'rgba(179, 128, 62, 0.01)';
  ctx.strokeStyle = secondaryColor; // الذهبي (#B3803E)
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(50, notesStartY - 10, 700, notesBoxHeight, 10);
  ctx.fill();
  ctx.stroke();

  // Draw an elegant small "تنبيه هام / شروط البيع" badge centered on the top border of the box!
  ctx.fillStyle = primaryColor; // البني الداكن (#541919)
  ctx.beginPath();
  ctx.roundRect(290, notesStartY - 22, 220, 24, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('شروط البيع وضمان الصيانة ⚠️', 400, notesStartY - 6);

  // Print notes inside the elegant container
  ctx.fillStyle = primaryColor; // Brown color for notes text
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  noteLines.forEach((line: string, index: number) => {
    ctx.fillText(line.trim(), 400, notesStartY + index * 22 + 22);
  });

  // Footer System Line
  const systemLineY = notesStartY + notesBoxHeight + 25;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`تم استخراج هذه الفاتورة بصيغة PDF إلكترونياً من نظام ${shopSettings?.shopName || 'الحسام فون'}`, 400, systemLineY);

  return canvas;
};

/**
 * Exports a given HTML element (or dynamic invoice objects) to a PDF file.
 * Handles both programmatic canvas drawing for invoices and html-to-image capturing for generic elements.
 */
export const exportToPDF = async (
  elementId: string, 
  fileName: string, 
  shouldShare = false,
  invoiceData?: any,
  shopSettings?: any
): Promise<string | null> => {
  const toastId = notify.loading('جاري توليد ملف PDF رسمي...');

  try {
    let imgData = '';
    let canvasWidth = 0;
    let canvasHeight = 0;

    // 1. GENERATE FILE PAYLOAD (Canvas Drawing vs html-to-image fallbacks)
    if (invoiceData && shopSettings) {
      // Programmatic Native Canvas Generator - Completely immune to Tailwind colors and oklch bugs
      const canvas = await drawInvoiceOnCanvas(invoiceData, shopSettings);
      imgData = canvas.toDataURL('image/jpeg', 0.65);
      canvasWidth = canvas.width / 2; // original scale size for A4/page matching ratio
      canvasHeight = canvas.height / 2;
    } else {
      // Generic element capture for reports and dashboard pages using html-to-image
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with ID ${elementId} not found`);
      }

      // Hide print-hidden buttons
      const buttons = element.querySelectorAll('button, .print\\:hidden, .print-hidden, [class*="print:hidden"]');
      const originalDisplays: string[] = [];
      buttons.forEach((el) => {
        const htmlEl = el as HTMLElement;
        originalDisplays.push(htmlEl.style.display);
        htmlEl.style.display = 'none';
      });

      // Execute modern html-to-image conversion to jpeg with 65% quality
      imgData = await toJpeg(element, {
        quality: 0.65,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        cacheBust: true,
        skipFonts: true,
        filter: (node: any) => {
          if (node && node.tagName === 'IMG') {
            const src = node.getAttribute('src');
            if (src && (src.startsWith('http') || src.startsWith('//')) && !src.includes(window.location.host)) {
              return false;
            }
          }
          return true;
        }
      });

      canvasWidth = element.clientWidth || 800;
      canvasHeight = element.clientHeight || 1100;

      // Restore print-hidden buttons
      buttons.forEach((el, i) => {
        (el as HTMLElement).style.display = originalDisplays[i];
      });
    }

    // 2. CONSTRUCT PDF DOCUMENT WITH COMPRESSION
    const pdf = new jsPDF({
      orientation: canvasWidth > canvasHeight ? 'l' : 'p',
      type: 'px',
      format: [canvasWidth, canvasHeight],
      compress: true
    } as any);

    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfPageWidth, pdfPageHeight, undefined, 'FAST');

    // Draw transparent watermark "نظام الحسام فون" at the center rotated 45 degrees with 0.1 opacity
    try {
      const gStateClass = (pdf as any).GState || (jsPDF as any).GState;
      if (gStateClass) {
        (pdf as any).saveGraphicsState();
        const gState = new gStateClass({ opacity: 0.1 });
        (pdf as any).setGState(gState);
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(Math.min(pdfPageWidth, pdfPageHeight) / 8);
        pdf.setTextColor(150, 150, 150);
        
        // Center of page watermark
        pdf.text("نظام الحسام فون", pdfPageWidth / 2, pdfPageHeight / 2, {
          align: "center",
          angle: 45
        } as any);
        
        (pdf as any).restoreGraphicsState();
      }
    } catch (watermarkErr) {
      console.warn("Could not draw transparent watermark inside jsPDF:", watermarkErr);
    }

    // 3. CAPACITOR MOBILE & WEB DESKTOP DEPLOYMENTS HANDLERS
    if (Capacitor.isNativePlatform()) {
      try {
        const pdfDataUri = pdf.output('datauristring');
        const base64Data = pdfDataUri.split(',')[1];
        const safeFileName = `${fileName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.pdf`;

        // Write file to native Documents directories (User persistent space)
        const writeResult = await Filesystem.writeFile({
          path: safeFileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        toast.dismiss(toastId);
        notify.success('تم تصدير وحفظ ملف الـ PDF بنجاح 📄');

        // Share native file directly to other native apps like WhatsApp
        if (shouldShare) {
          try {
            await Share.share({
              title: 'مشاركة الفاتورة',
              text: `مستند PDF رسمي بالفاتورة: ${fileName}`,
              url: writeResult.uri,
              dialogTitle: 'قم بمشاركة الفاتورة عبر التطبيقات',
            });
            notify.success('تم فتح قائمة المشاركة بنجاح!');
          } catch (shareErr: any) {
            console.error('Core Share API Failed:', shareErr);
            notify.error(`فشلت مشاركة الملف عبر النظام: ${shareErr.message || shareErr}`);
          }
        }
        return writeResult.uri;
      } catch (nativeErr: any) {
        console.warn('Saving to Documents directory failed, writing to Cache Directory:', nativeErr);
        
        // Secondary secure fallback directory
        try {
          const pdfDataUri = pdf.output('datauristring');
          const base64Data = pdfDataUri.split(',')[1];
          const safeFileName = `${fileName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.pdf`;

          const writeResult = await Filesystem.writeFile({
            path: safeFileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });

          toast.dismiss(toastId);
          notify.success('تم حفظ الفاتورة بنجاح في ذاكرة التخزين المؤقت 📄');

          if (shouldShare) {
            await Share.share({
              title: 'مشاركة الفاتورة',
              text: `مستند PDF رسمي بالفاتورة: ${fileName}`,
              url: writeResult.uri,
              dialogTitle: 'قم بمشاركة الفاتورة عبر التطبيقات',
            });
          }
          return writeResult.uri;
        } catch (fallbackCacheErr: any) {
          toast.dismiss(toastId);
          notify.error(`تعذر حفظ الملف مؤقتاً: ${fallbackCacheErr.message || fallbackCacheErr}`);
          throw fallbackCacheErr;
        }
      }
    } else {
      // Browser downloads and handles files directly
      pdf.save(`${fileName}.pdf`);
      toast.dismiss(toastId);
      notify.success('تم تنزيل الفاتورة بصيغة PDF بنجاح 📄');

      // Native Browser Web Share interface support
      if (shouldShare && navigator.share) {
        try {
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `فاتورة رقم ${fileName}`,
              text: `مستند PDF رسمي بالفاتورة: ${fileName}`,
            });
          }
        } catch (webShareErr) {
          console.warn('Web Share feature not fully supported on this viewport:', webShareErr);
        }
      }
      return null;
    }
  } catch (error: any) {
    console.error('Fatal Exception inside PDF Export Service:', error);
    toast.dismiss(toastId);
    
    let userMsg = '';
    if (error instanceof Event) {
      userMsg = 'تعذر تحميل بعض الملفات الخارجية (الخطوط أو الصور) بسبب قيود الشبكة أو سياسة CORS للـ iframe. يرجى إعادة المحاولة من متصفح خارجي.';
    } else if (error && typeof error === 'object') {
      userMsg = error.message || JSON.stringify(error);
    } else {
      userMsg = String(error);
    }

    notify.error(`فشل تصدير الفاتورة: ${userMsg}`);
    return null;
  }
};

/**
 * Generates an image from drawInvoiceOnCanvas and shares or downloads it.
 */
export const exportInvoiceAsImage = async (
  invoice: any,
  shopSettings: any,
  shouldShare = false
): Promise<string | null> => {
  const toastId = notify.loading('جاري تجهيز الفاتورة كصورة...');
  try {
    const canvas = await drawInvoiceOnCanvas(invoice, shopSettings);
    const imgDataUri = canvas.toDataURL('image/jpeg', 0.9);
    const base64Data = imgDataUri.split(',')[1];
    const safeFileName = `invoice_${(invoice.number || invoice.id || 'receipt').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.jpg`;

    if (Capacitor.isNativePlatform()) {
      try {
        const writeResult = await Filesystem.writeFile({
          path: safeFileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        toast.dismiss(toastId);
        notify.success('تم حفظ الفاتورة كصورة بنجاح 🖼️');

        if (shouldShare) {
          await Share.share({
            title: 'مشاركة الفاتورة كصورة',
            text: `صورة الفاتورة لطلب جوال: ${invoice.number}`,
            url: writeResult.uri,
            dialogTitle: 'مشاركة الفاتورة كصورة عبر الوتساب أو التطبيقات',
          });
        }
        return writeResult.uri;
      } catch (nativeErr: any) {
        // Fallback to cache directory
        try {
          const writeResult = await Filesystem.writeFile({
            path: safeFileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });

          toast.dismiss(toastId);
          notify.success('تم حفظ الفاتورة كصورة بنجاح 🖼️');

          if (shouldShare) {
            await Share.share({
              title: 'مشاركة الفاتورة كصورة',
              text: `صورة الفاتورة لطلب جوال: ${invoice.number}`,
              url: writeResult.uri,
              dialogTitle: 'مشاركة الفاتورة كصورة عبر الوتساب أو التطبيقات',
            });
          }
          return writeResult.uri;
        } catch (err: any) {
          toast.dismiss(toastId);
          notify.error(`فشل حفظ الصورة: ${err.message || err}`);
          throw err;
        }
      }
    } else {
      // Browser environment
      const link = document.createElement('a');
      link.href = imgDataUri;
      link.download = `${safeFileName}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(toastId);
      notify.success('تم تنزيل الفاتورة كصورة بنجاح 🖼️');

      if (shouldShare && navigator.share) {
        try {
          const fetchRes = await fetch(imgDataUri);
          const blob = await fetchRes.blob();
          const file = new File([blob], safeFileName, { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `فاتورة رقم ${invoice.number}`,
              text: `مشاركة صورة الفاتورة لطلب جوال ${invoice.number}`,
            });
          }
        } catch (webShareErr) {
          console.warn('Web Share image fallback failed:', webShareErr);
        }
      }
      return null;
    }
  } catch (err: any) {
    console.error('Core Image Share Service Fail:', err);
    toast.dismiss(toastId);
    notify.error(`فشل تجهيز ومشاركة الصورة: ${err.message || err}`);
    return null;
  }
};
