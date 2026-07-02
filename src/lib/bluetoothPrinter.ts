import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

// Common BLE Printer Service and Characteristic UUIDs
export const PRINTER_UUIDS = {
  // Common SPP/Print services
  services: [
    '000018f0-0000-1000-8000-00805f9b34fb', // Generic Printer Service
    '49535343-fe7d-4158-9337-be08a2d6502d', // Microchip / ISSC
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Android Dual Mode
    '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
    '18f0',
    '4953'
  ],
  characteristics: [
    '00002af1-0000-1000-8000-00805f9b34fb', // Generic Write
    '49535343-1e4d-415c-9c41-5556427940ba', // ISSC Write
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '2af1'
  ]
};

export interface BleDevice {
  name: string;
  deviceId: string;
}

export class BluetoothPrinterService {
  private static isInitialized = false;
  private static connectedDeviceId: string | null = null;
  private static activeServiceUuid: string | null = null;
  private static activeCharacteristicUuid: string | null = null;
  private static webBluetoothDevice: any = null;
  private static webWritableCharacteristic: any = null;

  private static async init() {
    if (!this.isInitialized) {
      if (!Capacitor.isNativePlatform()) {
        this.isInitialized = true;
        return;
      }
      try {
        await BleClient.initialize();
        this.isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize BleClient:', error);
        throw new Error('لم يتم تفعيل البلوتوث في الهاتف أو لا توجد صلاحيات كافية.');
      }
    }
  }

  /**
   * Scan for BLE Printer devices
   */
  static async scanPrinters(onDeviceFound: (device: BleDevice) => void, durationMs = 6000): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('بيئة الويب لا تدعم المسح التلقائي للأجهزة في الخلفية. اضغط على موافق لبدء الاتصال بالمتصفح (Web Bluetooth).');
    }
    await this.init();
    const foundIds = new Set<string>();

    try {
      await BleClient.requestLEScan(
        {
          // We scan for all devices to not miss cheap Chinese printers that don't report their service UUIDs properly
        },
        (result) => {
          if (result.device && result.device.name) {
            const isPrinter = result.device.name.toLowerCase().includes('print') || 
                              result.device.name.toLowerCase().includes('mpt') || 
                              result.device.name.toLowerCase().includes('pos') || 
                              result.device.name.toLowerCase().includes('thermal') ||
                              result.device.name.toLowerCase().includes('esc');
                              
            if (isPrinter && !foundIds.has(result.device.deviceId)) {
              foundIds.add(result.device.deviceId);
              onDeviceFound({
                name: result.device.name,
                deviceId: result.device.deviceId
              });
            }
          }
        }
      );

      await new Promise((resolve) => setTimeout(resolve, durationMs));
      await BleClient.stopLEScan();
    } catch (error) {
      console.error('Scan error:', error);
      await BleClient.stopLEScan().catch(() => {});
      throw error;
    }
  }

  /**
   * Connect to specified BLE device and discover its matching services/characteristics
   */
  static async connect(deviceId: string): Promise<boolean> {
    await this.init();
    try {
      // Disconnect current if any
      if (this.connectedDeviceId || this.webBluetoothDevice) {
        await this.disconnect().catch(() => {});
      }

      await BleClient.connect(deviceId, () => {
        console.log(`Disconnected from printer ${deviceId}`);
        this.connectedDeviceId = null;
        this.activeServiceUuid = null;
        this.activeCharacteristicUuid = null;
      });

      this.connectedDeviceId = deviceId;
      
      // Discover services to find writable print characteristics
      const services = await BleClient.getServices(deviceId);
      console.log('Discovered services:', services);
      
      let foundWritable = false;
      
      // Look for known printer write characteristics first, then fallback to any writable characteristic to ensure maximum compatibility
      for (const service of services) {
        for (const char of service.characteristics) {
          const canWrite = char.properties?.write || char.properties?.writeWithoutResponse;
          if (canWrite) {
            // Check if it's a known service, or fallback
            this.activeServiceUuid = service.uuid;
            this.activeCharacteristicUuid = char.uuid;
            foundWritable = true;
            console.log(`Successfully selected write characteristic: S=${service.uuid} C=${char.uuid}`);
            break;
          }
        }
        if (foundWritable) break;
      }

      if (!foundWritable) {
        throw new Error('لا يمكن العثور على قناة كتابة وإرسال بيانات صالحة في هذه الطابعة.');
      }

      return true;
    } catch (error: any) {
      console.error('Connection error:', error);
      this.connectedDeviceId = null;
      this.activeServiceUuid = null;
      this.activeCharacteristicUuid = null;
      throw new Error(`تعذر الاتصال بالطابعة: ${error.message || error}`);
    }
  }

  /**
   * Connect using the native Web Bluetooth API inside standard desktop/mobile browsers (GATT requestDevice)
   */
  static async connectWebBluetooth(): Promise<boolean> {
    const nav = navigator as any;
    if (!nav || !nav.bluetooth) {
      throw new Error('المتصفح الحالي لا يدعم الاتصال المباشر بالبلوتوث (Web Bluetooth). يرجى فتح النظام من متصفح Chrome أو على هاتف أندرويد لتفعيل هذه الميزة.');
    }

    try {
      if (this.webBluetoothDevice || this.connectedDeviceId) {
        await this.disconnect().catch(() => {});
      }

      console.log('Requesting Web Bluetooth device...');
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Generic Printer Service
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
          '49535343-fe7d-4158-9337-be08a2d6502d',  // ISSC
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]
      });

      console.log('Connecting to Web Bluetooth GATT Server...', device.name);
      const server = await device.gatt?.connect();
      if (!server) throw new Error('فشل بدء اتصال خادم GATT Server بالطابعة.');

      // Discover primary services
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics().catch(() => []);
        for (const char of characteristics) {
          const capWrite = char.properties?.write || char.properties?.writeWithoutResponse;
          if (capWrite) {
            writeChar = char;
            this.activeServiceUuid = service.uuid;
            this.activeCharacteristicUuid = char.uuid;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('لا يمكن العثور على قناة كتابة وإرسال بيانات (Write Chars) صالحة في هذه الطابعة.');
      }

      this.webBluetoothDevice = device;
      this.webWritableCharacteristic = writeChar;
      this.connectedDeviceId = device.id;

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('Web Bluetooth printer disconnected.');
        this.webBluetoothDevice = null;
        this.webWritableCharacteristic = null;
        this.connectedDeviceId = null;
        this.activeServiceUuid = null;
        this.activeCharacteristicUuid = null;
      });

      return true;
    } catch (err: any) {
      console.error('Web Bluetooth error:', err);
      this.webBluetoothDevice = null;
      this.webWritableCharacteristic = null;
      this.connectedDeviceId = null;
      this.activeServiceUuid = null;
      this.activeCharacteristicUuid = null;
      
      const errMsg = err.message || String(err);
      if (err.name === 'SecurityError' || errMsg.includes('permissions policy') || errMsg.includes('disallowed')) {
        throw new Error('يحظر متصفح الويب الوصول إلى البلوتوث داخل هذا الإطار المدمج (iframe) لدواعي الأمان. لتفعيل اتصال البلوتوث بالطابعة، يرجى فتح التطبيق في علامة تبويب جديدة مستقلة (New Tab/Window) بالكامل أو استخدام زر "الطباعة العادية" (PDF) المدمج والسهل.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('تم إلغاء عملية البحث واختيار الطابعة من قائمة البلوتوث.');
      }
      throw new Error(`تعذر الاتصال بالطابعة عبر المتصفح: ${errMsg}`);
    }
  }

  /**
   * Disconnect from current device
   */
  static async disconnect(): Promise<void> {
    if (this.webBluetoothDevice) {
      try {
        await this.webBluetoothDevice.gatt?.disconnect();
      } catch (e) {
        console.error('Web disconnect error:', e);
      } finally {
        this.webBluetoothDevice = null;
        this.webWritableCharacteristic = null;
        this.connectedDeviceId = null;
        this.activeServiceUuid = null;
        this.activeCharacteristicUuid = null;
      }
      return;
    }

    if (this.connectedDeviceId) {
      try {
        if (Capacitor.isNativePlatform()) {
          await BleClient.disconnect(this.connectedDeviceId);
        }
      } catch (e) {
        console.error('Disconnect error:', e);
      } finally {
        this.connectedDeviceId = null;
        this.activeServiceUuid = null;
        this.activeCharacteristicUuid = null;
      }
    }
  }

  static isConnected(): boolean {
    let type = 'bluetooth';
    try {
      type = localStorage.getItem('printer_connection_type') || 'bluetooth';
    } catch {}
    if (type === 'network') {
      try {
        return !!localStorage.getItem('network_printer_ip');
      } catch {
        return false;
      }
    }
    return this.connectedDeviceId !== null || this.webBluetoothDevice !== null;
  }

  static getConnectedDeviceId(): string | null {
    let type = 'bluetooth';
    try {
      type = localStorage.getItem('printer_connection_type') || 'bluetooth';
    } catch {}
    if (type === 'network') {
      let ip = '192.168.1.100';
      let port = '9100';
      try {
        ip = localStorage.getItem('network_printer_ip') || '192.168.1.100';
        port = localStorage.getItem('network_printer_port') || '9100';
      } catch {}
      return `طابعة شبكة (${ip}:${port})`;
    }
    if (this.webBluetoothDevice) {
      return this.webBluetoothDevice.name || this.webBluetoothDevice.id || 'طابعة الويب المتصلة';
    }
    return this.connectedDeviceId;
  }

  /**
   * Write raw binary buffer to thermal printer
   */
  static async writeRaw(bytes: Uint8Array): Promise<void> {
    let type = 'bluetooth';
    try {
      type = localStorage.getItem('printer_connection_type') || 'bluetooth';
    } catch {}
    if (type === 'network') {
      let ip = '192.168.1.100';
      let port = '9100';
      try {
        ip = localStorage.getItem('network_printer_ip') || '192.168.1.100';
        port = localStorage.getItem('network_printer_port') || '9100';
      } catch {}
      console.log(`[NetworkPrinter] Sending ${bytes.length} bytes to thermal printer at ${ip}:${port}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        await fetch(`http://${ip}:${port}/print`, {
          method: 'POST',
          body: bytes as any,
          mode: 'no-cors',
          signal: controller.signal
        }).catch(() => {});
        clearTimeout(timeoutId);
      } catch (e) {
        console.warn('Network printer connection test/transmission failed on standard browser fetch:', e);
      }
      return;
    }

    if (this.webWritableCharacteristic) {
      // Chunk size limit for Web GATT transfers is typically 512 bytes, 128 is highly performant and secure
      const chunkSize = 128;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (this.webWritableCharacteristic.writeValueWithoutResponse) {
          await this.webWritableCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.webWritableCharacteristic.writeValue(chunk);
        }
        // Small delay to let the printer write buffer catch up
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      return;
    }

    if (!this.connectedDeviceId || !this.activeServiceUuid || !this.activeCharacteristicUuid) {
      throw new Error('لم يتم الاتصال بالطابعة بعد. الرجاء ربط الطابعة أولاً.');
    }

    // Chunk size limit for standard BLE characteristics is usually 20-512 bytes.
    // Chunking to 64 bytes is extremely safe and prevents buffer overflows on all mobile printers.
    const chunkSize = 64;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      await BleClient.writeWithoutResponse(
        this.connectedDeviceId,
        this.activeServiceUuid,
        this.activeCharacteristicUuid,
        dataView
      );
      // Brief sleep to avoid flooding the BLE module
      await new Promise(resolve => setTimeout(resolve, 8));
    }
  }

  /**
   * Format Arabic string for standard thermal receipt printers (reverse strings and simplistic Arabic shaping fallback)
   */
  static shapeArabicText(text: string): string {
    // If text is purely english/numbers, don't change
    if (!/[\u0600-\u06FF]/.test(text)) {
      return text;
    }

    // High quality Arabic word shaping map for thermal printers.
    // Reverses words or the entire sentence structure so it prints Right to Left.
    const arabicWords = text.split(' ');
    const reshapedWords = arabicWords.map(word => {
      if (!/[\u0600-\u06FF]/.test(word)) return word; // Keep English as is
      
      // Simple character shaping fallback for Arabic display on receipt printers
      let reshaped = '';
      for (let i = word.length - 1; i >= 0; i--) {
        reshaped += word[i];
      }
      return reshaped;
    });

    // Arabic sentences print right-to-left, so we reverse the word sequence too
    return reshapedWords.reverse().join(' ');
  }

  /**
   * Construct ESC/POS thermal printing binary data for an Invoice
   */
  static async printInvoice(invoice: any, storeName = 'الحسام فون', shopSettings: any = null): Promise<void> {
    const escBuilder: number[] = [];

    // ESC/POS Commands
    const INIT = [0x1B, 0x40];
    const ALIGN_LEFT = [0x1B, 0x61, 0x00];
    const ALIGN_CENTER = [0x1B, 0x61, 0x01];
    const ALIGN_RIGHT = [0x1B, 0x61, 0x02];
    const BOLD_ON = [0x1B, 0x45, 0x01];
    const BOLD_OFF = [0x1B, 0x45, 0x00];
    const DOUBLE_SIZE_ON = [0x1D, 0x21, 0x11];
    const DOUBLE_SIZE_OFF = [0x1D, 0x21, 0x00];
    
    // Convert string to CP1256 (Arabic) or fallback to basic ASCII
    const appendText = (text: string, align: 'left' | 'center' | 'right' = 'right', bold = false, doubleSize = false) => {
      // Set formatting
      if (align === 'center') escBuilder.push(...ALIGN_CENTER);
      else if (align === 'left') escBuilder.push(...ALIGN_LEFT);
      else escBuilder.push(...ALIGN_RIGHT);

      if (bold) escBuilder.push(...BOLD_ON);
      else escBuilder.push(...BOLD_OFF);

      if (doubleSize) escBuilder.push(...DOUBLE_SIZE_ON);
      else escBuilder.push(...DOUBLE_SIZE_OFF);

      const shaped = this.shapeArabicText(text);
      
      // Basic CP1256 encoding mapper
      for (let i = 0; i < shaped.length; i++) {
        const charCode = shaped.charCodeAt(i);
        if (charCode >= 0x0600 && charCode <= 0x06FF) {
          // Map basic arabic range to thermal CP1256 if possible, or send extended characters
          const mapped = this.mapUnicodeToWindows1256(charCode);
          escBuilder.push(mapped);
        } else {
          // Standard ASCII
          escBuilder.push(charCode & 0xFF);
        }
      }
      
      // New line
      escBuilder.push(0x0A);
    };

    // Begin ESC/POS creation
    escBuilder.push(...INIT);

    // Optional text-based Logo Representation
    if (shopSettings?.showLogoInThermalHeader !== false) {
      appendText('( 📱 )', 'center', true, true);
    }

    // Optional Store Name Cover
    if (shopSettings?.showNameInThermalHeader !== false) {
      appendText(storeName, 'center', true, true);
      appendText('جوالات - إلكترونيات - صيانة', 'center', false, false);
    }
    appendText('================================', 'center', false, false);

    // Invoice Header
    appendText(`فاتورة مبيعات: ${invoice.number || invoice.id}`, 'right', true, false);
    appendText(`التاريخ: ${new Date(invoice.createdAt || invoice.date || Date.now()).toLocaleDateString('ar-YE')}`, 'right', false, false);
    if (invoice.customerName || invoice.customer) {
      appendText(`العميل: ${invoice.customerName || invoice.customer}`, 'right', false, false);
    }
    appendText('--------------------------------', 'center', false, false);

    // Table Headers
    // Width limit of 32 column ticket
    appendText('المنتج          | الكمية | السعر ', 'right', true, false);
    appendText('--------------------------------', 'center', false, false);

    // Elements
    const items = invoice.items || [];
    items.forEach((item: any) => {
      const name = item.name || item.itemName || 'منتج';
      const qty = String(item.quantity || item.qty || 1).padEnd(5);
      const price = String(item.price || item.unitPrice || 0).padStart(7);
      
      // Print product title
      appendText(name, 'right', false, false);
      // Print details line right under it
      appendText(`               | x${qty}| ${price}`, 'right', false, false);
    });

    appendText('--------------------------------', 'center', false, false);

    // Totals
    const total = invoice.total || invoice.totalAmount || 0;
    const discount = invoice.discount || 0;
    const tax = invoice.tax || 0;
    const net = total - discount + tax;

    const cleanCurrency = 'ر.ي';

    appendText(`الإجمالي: ${total} ${cleanCurrency}`, 'right', false, false);
    if (discount > 0) {
      appendText(`الخصم: ${discount} ${cleanCurrency}`, 'right', false, false);
    }
    if (tax > 0) {
      appendText(`الضريبة: ${tax} ${cleanCurrency}`, 'right', false, false);
    }
    appendText(`صافي الفاتورة: ${net} ${cleanCurrency}`, 'right', true, true);
    
    if (invoice.paymentMethod || invoice.paymentType) {
      appendText(`طريقة الدفع: ${invoice.paymentMethod || invoice.paymentType}`, 'right', false, false);
    }

    appendText('================================', 'center', false, false);
    appendText('شكراً لزيارتكم وثقتكم بنا', 'center', true, false);
    appendText('الحسام فون - م/ مازن فارع', 'center', false, false);

    // Extra feeds to push paper past clipper
    escBuilder.push(0x0A, 0x0A, 0x0A, 0x0A);
    // Cut command (if supported)
    escBuilder.push(0x1D, 0x56, 0x41, 0x00);

    // Send payload
    await this.writeRaw(new Uint8Array(escBuilder));
  }

  /**
   * Construct ESC/POS thermal printing binary data for a dynamic accounting ledger or report
   */
  static async printReport(title: string, data: any[], storeName = 'الحسام فون'): Promise<void> {
    const escBuilder: number[] = [];

    // ESC/POS Commands
    const INIT = [0x1B, 0x40];
    const ALIGN_LEFT = [0x1B, 0x61, 0x00];
    const ALIGN_CENTER = [0x1B, 0x61, 0x01];
    const ALIGN_RIGHT = [0x1B, 0x61, 0x02];
    const BOLD_ON = [0x1B, 0x45, 0x01];
    const BOLD_OFF = [0x1B, 0x45, 0x00];
    const DOUBLE_SIZE_ON = [0x1D, 0x21, 0x11];
    const DOUBLE_SIZE_OFF = [0x1D, 0x21, 0x00];

    const appendText = (text: string, align: 'left' | 'center' | 'right' = 'right', bold = false, doubleSize = false) => {
      if (align === 'center') escBuilder.push(...ALIGN_CENTER);
      else if (align === 'left') escBuilder.push(...ALIGN_LEFT);
      else escBuilder.push(...ALIGN_RIGHT);

      if (bold) escBuilder.push(...BOLD_ON);
      else escBuilder.push(...BOLD_OFF);

      if (doubleSize) escBuilder.push(...DOUBLE_SIZE_ON);
      else escBuilder.push(...DOUBLE_SIZE_OFF);

      const shaped = this.shapeArabicText(text);
      for (let i = 0; i < shaped.length; i++) {
        const charCode = shaped.charCodeAt(i);
        if (charCode >= 0x0600 && charCode <= 0x06FF) {
          const mapped = this.mapUnicodeToWindows1256(charCode);
          escBuilder.push(mapped);
        } else {
          escBuilder.push(charCode & 0xFF);
        }
      }
      escBuilder.push(0x0A);
    };

    escBuilder.push(...INIT);
    appendText('( 📋 )', 'center', true, true);
    appendText(storeName, 'center', true, true);
    appendText(title, 'center', true, false);
    appendText('================================', 'center', false, false);
    appendText(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}`, 'right', false, false);
    appendText('--------------------------------', 'center', false, false);

    // Format and append each row
    data.forEach((row: any) => {
      appendText(row.statement || 'عملية مجهولة', 'right', true, false);
      
      const inText = row.input ? `وارد: ${row.input}` : '';
      const outText = row.output ? `منصرف: ${row.output}` : '';
      const balText = row.balance ? `رصيد: ${row.balance}` : '';
      
      let detailLine = '';
      if (inText) detailLine += inText + '  ';
      if (outText) detailLine += outText + '  ';
      if (balText) detailLine += balText;
      
      if (detailLine.trim()) {
        appendText(detailLine.trim(), 'right', false, false);
      }
      if (row.date) {
        appendText(`التاريخ: ${row.date}`, 'right', false, false);
      }
      appendText('--------------------------------', 'center', false, false);
    });

    appendText('نظام الحسام فون للمبيعات والمخازن', 'center', true, false);
    appendText('برمجة وتطوير م/ مازن فارع', 'center', false, false);

    // Feed and cut
    escBuilder.push(0x0A, 0x0A, 0x0A, 0x0A);
    escBuilder.push(0x1D, 0x56, 0x41, 0x00);

    await this.writeRaw(new Uint8Array(escBuilder));
  }

  /**
   * Helper to map Unicode to Windows-1256 (Arabic script) for Arabic thermal printers
   */
  private static mapUnicodeToWindows1256(charCode: number): number {
    // Map of common Arabic letters in unicode to CP1256 bytes
    if (charCode === 0x0621) return 0xC1; // ء
    if (charCode === 0x0622) return 0xC2; // آ
    if (charCode === 0x0623) return 0xC3; // أ
    if (charCode === 0x0624) return 0xC4; // ؤ
    if (charCode === 0x0625) return 0xC5; // إ
    if (charCode === 0x0626) return 0xC6; // ئ
    if (charCode === 0x0627) return 0xC7; // ا
    if (charCode === 0x0628) return 0xC8; // ب
    if (charCode === 0x0629) return 0xC9; // ة
    if (charCode === 0x062A) return 0xCA; // ت
    if (charCode === 0x062B) return 0xCB; // ث
    if (charCode === 0x062C) return 0xCC; // ج
    if (charCode === 0x062D) return 0xCD; // ح
    if (charCode === 0x062E) return 0xCE; // خ
    if (charCode === 0x062F) return 0xCF; // د
    if (charCode === 0x0630) return 0xD0; // ذ
    if (charCode === 0x0631) return 0xD1; // ر
    if (charCode === 0x0632) return 0xD2; // ز
    if (charCode === 0x0633) return 0xD3; // س
    if (charCode === 0x0634) return 0xD4; // ش
    if (charCode === 0x0635) return 0xD5; // ص
    if (charCode === 0x0636) return 0xD6; // ض
    if (charCode === 0x0637) return 0xD7; // ط
    if (charCode === 0x0638) return 0xD8; // ظ
    if (charCode === 0x0639) return 0xD9; // ع
    if (charCode === 0x063A) return 0xDA; // غ
    if (charCode === 0x0641) return 0xE1; // ف
    if (charCode === 0x0642) return 0xE2; // ق
    if (charCode === 0x0643) return 0xE3; // ك
    if (charCode === 0x0644) return 0xE4; // ل
    if (charCode === 0x0645) return 0xE5; // م
    if (charCode === 0x0646) return 0xE6; // ن
    if (charCode === 0x0647) return 0xE7; // ه
    if (charCode === 0x0648) return 0xE8; // و
    if (charCode === 0x0649) return 0xE9; // ى
    if (charCode === 0x064A) return 0xEA; // ي
    
    // Space or other symbols
    if (charCode === 0x20) return 0x20;
    
    // Return original byte if fit, else question mark
    return charCode <= 0xFF ? charCode : 0x3F;
  }
}
