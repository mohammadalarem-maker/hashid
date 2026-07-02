-- Al-Husam Phone - ملف تهيئة الجداول المنفصلة لمخزون الكروت وشحن الرصيد
-- Database Update script: network_services_v2.sql

USE `alhusam_phone`;

-- 1. التأكد من وجود جدول دليل الخدمات للشبكات والاتصالات (network_services)
CREATE TABLE IF NOT EXISTS `network_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم الخدمة (مثل: كروت المجد 500، رصيد باقات يو)',
    `type` ENUM('balance', 'cards') NOT NULL COMMENT 'النوع: balance (رصيد مرن) أو cards (كروت فئات)',
    `network_name` VARCHAR(100) NOT NULL COMMENT 'اسم الشركة/الشبكة (يو، يمن موبايل، سبأفون، المجد)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. جدول مخزن الكروت الجاهزة (network_cards_stock)
-- يظهر هذا السجل فقط عند اختيار نوع الخدمة "كروت شبكة"
CREATE TABLE IF NOT EXISTS `network_cards_stock` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_id` INT NOT NULL COMMENT 'معرف الخدمة المرتبط بجدول الدليل',
    `denomination` DECIMAL(10, 2) NOT NULL COMMENT 'قيمة الكرت الواحد (الفئة: 100, 250, 500)',
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'سعر التكلفة للكرت الواحد للشبكة',
    `sale_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'سعر البيع النهائي للعميل',
    `stock_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'عدد الكروت المتوفرة حالياً بالمخزن',
    `unit` VARCHAR(50) NOT NULL DEFAULT 'كرت' COMMENT 'الوحدة الافتراضية (كرت)',
    `min_limit` DECIMAL(10, 2) NOT NULL DEFAULT 10.00 COMMENT 'حد التنبيه عند اقتراب نفاد كمية الكروت',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_cards_stock_services` FOREIGN KEY (`service_id`) REFERENCES `network_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. جدول مخزن رصيد وباقات الاتصالات (balance_packages_stock)
-- يظهر هذا السجل فقط عند اختيار نوع الخدمة "شحن وتعبئة رصيد باقات"
CREATE TABLE IF NOT EXISTS `balance_packages_stock` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_id` INT NOT NULL COMMENT 'معرف الخدمة المرتبط بجدول الدليل',
    `cost_price` DECIMAL(10, 4) NOT NULL DEFAULT 1.0000 COMMENT 'نسبة تكلفة الشراء (مثل 0.9700 لشحن خصم 3%)',
    `sale_price` DECIMAL(10, 2) NOT NULL DEFAULT 1.00 COMMENT 'سعر البيع الفعلي للريال الواحد (غالباً 1.00 ريال لكل 1 ريال)',
    `stock_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'إجمالي الرصيد المالي الكلي المتوفر للخصم المباشر (بالريال اليمني)',
    `unit` VARCHAR(50) NOT NULL DEFAULT 'ريال' COMMENT 'الوحدة الافتراضية (ريال)',
    `min_limit` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00 COMMENT 'حد التنبيه عند اقتراب نفاد الرصيد المالي التراكمي',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_balance_stock_services` FOREIGN KEY (`service_id`) REFERENCES `network_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. تعديل أو إضافة حقل رقم هاتف المستفيد في جدول تفاصيل المبيعات (sales_items) إن لم يكن موجوداً
-- لتمكين ربط كل عملية شحن أو مبيع برقم هاتف المستلم
ALTER TABLE `sales_items` 
ADD COLUMN `beneficiary_phone` VARCHAR(50) NULL DEFAULT NULL COMMENT 'رقم هاتف المستفيد لشحن الرصيد المرن للشبكات الاتصالية أو كروت الواي فاي';
