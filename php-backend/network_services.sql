-- ========================================================================
-- Al-Husam Phone System - قاعدة بيانات نظام الحسام فون
-- SQL Script: إعادة هيكلة وتصميم قاعدة البيانات لتفصل بين "دليل الخدمات وفئاتها الثابتة" وبين "حركة كميات المخزن والرصيد المتاح"
-- ========================================================================

-- إيقاف التحقق من المفاتيح الأجنبية مؤقتاً لتسهيل عملية التحديث والتهيئة
SET FOREIGN_KEY_CHECKS = 0;

-- 1. جدول دليل الخدمات الرئيسي (Service Catalog)
DROP TABLE IF EXISTS `network_services_stock`;
DROP TABLE IF EXISTS `network_services`;

CREATE TABLE `network_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم الخدمة (مثل: رصيد باقات يو المرن، كروت شبكة المجد المحلية)',
    `type` ENUM('balance', 'cards') NOT NULL COMMENT 'الآلية: رصيد مالي مرن (balance) أو كروت فئات محددة (cards)',
    `network_name` VARCHAR(100) NOT NULL COMMENT 'اسم شبكة الاتصالات أو الواي فاي الموفرة (يو، يمن موبايل، سبأفون، المجد، اليرموك)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. جدول كميات المخزن والفئات والأسعار والرصيد المتاح (Stock & Inventory)
CREATE TABLE `network_services_stock` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_id` INT NOT NULL COMMENT 'معرف الخدمة المرتبط بجدول الدليل',
    `denomination` DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'فئة الكرت (100، 250، 500 ريال) - وتكون NULL في حالة الرصيد المرن',
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: سعر تكلفة الكرت الواحد. في الرصيد: نسبة التكلفة (مثل 0.9700 لشحن خصم 3%)',
    `sale_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: سعر البيع الثابت. في الرصيد: سعر بيع الوحدة (غالباً 1.00 ريال لكل ريال شحن)',
    `stock_qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'في الكروت: عدد الكروت المتوفرة. في الرصيد: إجمالي كتلة الرصيد المتبقي بالريال',
    `unit` VARCHAR(50) NOT NULL DEFAULT 'كرت' COMMENT 'الوحدة (كرت، ريال)',
    `min_limit` DECIMAL(10, 2) NOT NULL DEFAULT 10.00 COMMENT 'الحد الأدنى للتنبيه عند انخفاض المخزن',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_network_stock_services` FOREIGN KEY (`service_id`) REFERENCES `network_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إعادة تفعيل التحقق من المفاتيح الأجنبية
SET FOREIGN_KEY_CHECKS = 1;

-- 3. إدراج قيم افتراضية حقيقية تتناسب مع طبيعة عمل نظام "الحسام فون"
-- إدراج الخدمات في دليل الخدمات
INSERT INTO `network_services` (`id`, `name`, `type`, `network_name`) VALUES
(1, 'رصيد باقات يو (كتلة مرنة)', 'balance', 'يو'),
(2, 'رصيد يمن موبايل مباشر (كتلة مرنة)', 'balance', 'يمن موبايل'),
(3, 'كروت شبكة المجد المحلية (فئات محددة)', 'cards', 'شبكة المجد'),
(4, 'كروت واي فاي اليرموك (فئات محددة)', 'cards', 'شبكة اليرموك');

-- إدراج كميات المخزن والفئات والأسعار
INSERT INTO `network_services_stock` (`service_id`, `denomination`, `cost_price`, `sale_price`, `stock_qty`, `unit`, `min_limit`) VALUES
-- رصيد باقات يو: شحن حساب الوكيل بكتلة 50,000 ريال مع نسبة تكلفة 0.9700 (أي خصم 3% من الموزع)
(1, NULL, 0.97, 1.00, 50000.00, 'ريال', 2000.00),
-- رصيد يمن موبايل مباشر: كتلة 30,000 ريال مع نسبة تكلفة 0.9500 (أي خصم 5% من الموزع)
(2, NULL, 0.95, 1.00, 30000.00, 'ريال', 1500.00),
-- كروت شبكة المجد: 3 فئات ثابتة والسعر يحدد لكل فئة
(3, 100.00, 85.00, 100.00, 150.00, 'كرت', 20.00),
(3, 250.00, 215.00, 250.00, 100.00, 'كرت', 15.00),
(3, 500.00, 430.00, 500.00, 80.00, 'كرت', 10.00),
-- كروت واي فاي اليرموك: 3 فئات ثابتة والسعر يحدد لكل فئة
(4, 100.00, 80.00, 100.00, 120.00, 'كرت', 20.00),
(4, 250.00, 200.00, 250.00, 80.00, 'كرت', 15.00),
(4, 500.00, 410.00, 500.00, 50.00, 'كرت', 10.00);
