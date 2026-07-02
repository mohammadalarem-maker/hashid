-- Al-Husam Phone - ملف تهيئة قاعدة البيانات والتحديثات الخاصة بسيناريو بيع الرصيد المرن برقم المستفيد
-- Database Update script: sell_balance.sql

USE `alhusam_phone`;

-- 1. إضافة حقل رقم المستفيد (رقم هاتف العميل) إلى جدول تفاصيل المبيعات (sales_items)
-- لكي يتم تسجيل رقم الهاتف المستلم للشحن مع كل عملية بيع رصيد مرن
ALTER TABLE `sales_items` 
ADD COLUMN `beneficiary_phone` VARCHAR(50) NULL DEFAULT NULL COMMENT 'رقم هاتف المستفيد لشحن الرصيد المرن للشبكات الاتصالية أو كروت الواي فاي';

-- 2. للتأكيد على الهيكلية المتكاملة، نرفق هنا بنية الجداول ذات الصلة بمبيعات الرصيد والربح ونسبة التكلفة:

-- جدول دليل الخدمات للشبكات والاتصالات (network_services)
CREATE TABLE IF NOT EXISTS `network_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم الخدمة (مثل: رصيد باقات يو المرن، كروت شبكة المجد المحلية)',
    `type` ENUM('balance', 'cards') NOT NULL COMMENT 'الآلية: رصيد مالي مرن (balance) أو كروت فئات محددة (cards)',
    `network_name` VARCHAR(100) NOT NULL COMMENT 'اسم شبكة الاتصالات أو الواي فاي الموفرة (يو، يمن موبايل، سبأفون، المجد)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول مخزن الخدمات (network_services_stock)
CREATE TABLE IF NOT EXISTS `network_services_stock` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_id` INT NOT NULL COMMENT 'معرف الخدمة المرتبط بجدول الدليل',
    `denomination` DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'فئة الكرت (100، 250، 500 ريال) - وتكون NULL في حالة الرصيد المرن',
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: سعر تكلفة الكرت الواحد. في الرصيد: نسبة التكلفة (مثل 0.9700 لشحن خصم 3%)',
    `sale_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: سعر البيع الثابت. في الرصيد: سعر بيع الوحدة (غالباً 1.00 ريال لكل ريال شحن)',
    `stock_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: عدد الكروت المتوفرة. في الرصيد: إجمالي كتلة الرصيد المتبقي بالريال',
    `unit` VARCHAR(50) NOT NULL DEFAULT 'ريال' COMMENT 'الوحدة (كرت، ريال)',
    `min_limit` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00 COMMENT 'الحد الأدنى للتنبيه عند انخفاض المخزن',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_network_stock_services_balance` FOREIGN KEY (`service_id`) REFERENCES `network_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المبيعات الرئيسي (sales)
CREATE TABLE IF NOT EXISTS `sales` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` VARCHAR(50) NOT NULL UNIQUE,
    `customer_name` VARCHAR(150) NOT NULL DEFAULT 'عميل سفري',
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `profit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `cashier` VARCHAR(100) NOT NULL DEFAULT 'الكاشير الحسام',
    `payment_method` VARCHAR(50) NOT NULL DEFAULT 'نقداً',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول تفاصيل المبيعات (sales_items)
CREATE TABLE IF NOT EXISTS `sales_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sale_id` INT NOT NULL,
    `service_id` INT NULL DEFAULT NULL,
    `name` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `profit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `beneficiary_phone` VARCHAR(50) NULL DEFAULT NULL COMMENT 'رقم هاتف المستفيد لشحن الرصيد المرن للشبكات الاتصالية أو كروت الواي فاي',
    CONSTRAINT `fk_sales_items_sale_id` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. إضافة الفهارس (Indexes) لتحسين سرعة الاستعلامات والبحث والتقارير الدورية (Performance Optimization)
CREATE INDEX `idx_sales_items_service_id` ON `sales_items` (`service_id`);
CREATE INDEX `idx_sales_items_sale_id` ON `sales_items` (`sale_id`);
CREATE INDEX `idx_sales_created_at` ON `sales` (`created_at`);
CREATE INDEX `idx_network_services_stock_service_id` ON `network_services_stock` (`service_id`);
