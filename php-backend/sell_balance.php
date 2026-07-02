<?php
ob_start();
/**
 * Al-Husam Phone - معالجة مبيعات الرصيد المرن المباشر برقم هاتف المستفيد وحساب الأرباح التلقائي
 * API Endpoint: sell_balance.php
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'fcm_helper.php';

// إعدادات الاتصال بقاعدة البيانات المحلية للمستخدم
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'alhusam_phone');

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'فشل الاتصال بقاعدة البيانات المحلية: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// قراءة بيانات الطلب (JSON أو POST)
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);
if (empty($input)) {
    $input = $_POST;
}

$serviceId        = isset($input['service_id']) ? intval($input['service_id']) : 0;
$saleAmount       = isset($input['sale_amount']) ? floatval($input['sale_amount']) : 0.0; // مبلغ البيع المطلوب (مثلاً: 500 ريال)
$beneficiaryPhone = isset($input['beneficiary_phone']) ? trim($input['beneficiary_phone']) : ''; // رقم المستفيد
$cashierName      = isset($input['cashier_name']) ? trim($input['cashier_name']) : 'الكاشير الحسام';
$customerName     = isset($input['customer_name']) ? trim($input['customer_name']) : 'عميل سفري';
$invoiceId        = isset($input['invoice_id']) ? trim($input['invoice_id']) : '';

// التحقق من صحة المدخلات
if ($serviceId <= 0 || $saleAmount <= 0) {
    echo json_encode([
        'status' => 'error',
        'message' => 'بيانات غير مكتملة أو خاطئة. يجب توفير معرف الخدمة ومبلغ البيع بشكل أكبر من الصفر.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($beneficiaryPhone)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'يرجى إدخال رقم هاتف المستفيد لإتمام عملية الشحن المباشر للرصيد.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. جلب بيانات الخدمة والتأكد من أنها رصيد مرن (balance)
    $stmt = $pdo->prepare("SELECT * FROM `network_services` WHERE `id` = ?");
    $stmt->execute([$serviceId]);
    $service = $stmt->fetch();

    if (!$service) {
        throw new Exception('الخدمة المطلوبة غير متوفرة في دليل النظام.');
    }

    if ($service['type'] !== 'balance') {
        throw new Exception('الخدمة المحددة ليست خدمة شحن رصيد مرن.');
    }

    $serviceName = $service['name'];
    $networkName = $service['network_name'];

    // 2. جلب وتحديث المخزن الخاص بالرصيد مع قفل السجل لضمان الحماية من التزامن
    $stockStmt = $pdo->prepare("SELECT * FROM `balance_packages_stock` WHERE `service_id` = ? FOR UPDATE");
    $stockStmt->execute([$serviceId]);
    $stockItem = $stockStmt->fetch();

    if (!$stockItem) {
        throw new Exception('لم يتم شحن أو تغذية حساب رصيد هذه الخدمة حتى الآن بالمخزن.');
    }

    // 3. التحقق من كفاية الرصيد الإجمالي المشحون بالمخزن
    if ($stockItem['stock_qty'] < $saleAmount) {
        throw new Exception("عذراً، الرصيد المتبقي في المخزن غير كافٍ! المتوفر حالياً: " . number_format($stockItem['stock_qty']) . " ريال يمني.");
    }

    // 4. العمليات الحسابية:
    // - التكلفة = مبلغ البيع * نسبة التكلفة (مثلاً: 1000 ريال * 0.9700 = 970 ريال)
    // - سعر البيع = مبلغ البيع (1.00 ريال لكل 1 ريال)
    // - الأرباح = مبلغ البيع - التكلفة (1000 - 970 = 30 ريال)
    $costRatio  = floatval($stockItem['cost_price']); // نسبة التكلفة
    $unitPrice  = floatval($stockItem['sale_price']); // سعر بيع الوحدة (غالباً 1.00)
    
    $totalSales = $saleAmount * $unitPrice;
    $totalCost  = $saleAmount * $costRatio;
    $profit     = $totalSales - $totalCost;

    // 5. خصم وطرح مبلغ البيع من المبلغ الإجمالي المشحون في المخزن
    $newStock = $stockItem['stock_qty'] - $saleAmount;
    $updateStockStmt = $pdo->prepare("UPDATE `balance_packages_stock` SET `stock_qty` = ? WHERE `id` = ?");
    $updateStockStmt->execute([$newStock, $stockItem['id']]);

    // 6. إنشاء الفاتورة في جدول المبيعات الرئيسي (sales)
    if (empty($invoiceId)) {
        $invoiceId = "INV-BAL-" . date('ymdHis') . rand(10, 99);
    }

    $salesStmt = $pdo->prepare("INSERT INTO `sales` (`invoice_id`, `customer_name`, `total_amount`, `profit`, `cashier`, `payment_method`) VALUES (?, ?, ?, ?, ?, 'نقداً')");
    $salesStmt->execute([$invoiceId, $customerName, $totalSales, $profit, $cashierName]);
    $salesTableId = $pdo->lastInsertId();

    // 7. إدراج تفاصيل عملية الشحن في جدول المبيعات الفرعي (sales_items) مع تسجيل رقم المستفيد
    $itemsStmt = $pdo->prepare("INSERT INTO `sales_items` (`sale_id`, `service_id`, `name`, `quantity`, `price`, `cost_price`, `profit`, `beneficiary_phone`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $itemsStmt->execute([
        $salesTableId,
        $serviceId,
        "شحن رصيد مباشر لـ {$serviceName} للرقم ({$beneficiaryPhone})",
        $saleAmount,
        $unitPrice,
        $costRatio,
        $profit,
        $beneficiaryPhone
    ]);

    // 8. تسجيل حركة مالية للصندوق (safe_transactions)
    $safeStmt = $pdo->prepare("INSERT INTO `safe_transactions` (`type`, `amount`, `source`, `description`) VALUES ('in', ?, 'مبيعات رصيد مباشر', ?)");
    $safeStmt->execute([
        $totalSales,
        "مبيعات رصيد باقات يو مباشر للرقم {$beneficiaryPhone} بقيمة {$totalSales} ريال"
    ]);

    $pdo->commit();

    // 9. إرسال إشعار سحابي FCM وتحذير إذا انخفض المخزن عن الحد الأدنى (العملية تجري بالخلفية)
    $isLowStock = ($newStock <= $stockItem['min_limit']);

    // تجهيز مخرجات البيانات لطباعة الفاتورة الفورية
    $printPayload = [
        'invoice_id' => $invoiceId,
        'service_name' => "شحن رصيد {$serviceName}",
        'type' => 'balance',
        'network_name' => $networkName,
        'qty' => $saleAmount,
        'price' => $unitPrice,
        'total' => $totalSales,
        'date' => date('Y-m-d H:i:s'),
        'cashier' => $cashierName,
        'customer' => $customerName,
        'beneficiary_phone' => $beneficiaryPhone,
        'profit' => $profit
    ];

    $out = json_encode([
        'status' => 'success',
        'message' => "تم شحن الرصيد للرقم ({$beneficiaryPhone}) بنجاح بقيمة {$saleAmount} ريال، وتم تحديث المخازن وحساب الربح.",
        'new_stock' => $newStock,
        'is_low_stock' => $isLowStock,
        'print_payload' => $printPayload
    ], JSON_UNESCAPED_UNICODE);

    // إرسال الرد وإغلاق الاتصال فورا لإنهاء الفاتورة في جزء من الثانية
    ignore_user_abort(true);
    set_time_limit(120);

    header('Connection: close');
    header('Content-Length: ' . strlen($out));
    if (ob_get_length()) {
        ob_end_clean();
    }
    ob_start();
    echo $out;
    ob_end_flush();
    flush();

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    // تنفيذ المهام البطيئة في الخلفية بعد إنهاء طلب العميل
    if ($isLowStock) {
        $warningTitle = "⚠️ تنبيه انخفاض رصيد الخدمة";
        $warningBody = "رصيد الخدمة ({$serviceName}) شارف على النفاد! المتبقي حالياً: " . number_format($newStock) . " ريال.";
        FCMHelper::sendToTopic('all_users', $warningTitle, $warningBody, [
            'type' => 'low_stock_warning',
            'service_id' => (string)$serviceId,
            'remaining_stock' => (string)$newStock
        ]);
    }

} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode([
        'status' => 'error',
        'message' => 'فشلت عملية البيع والشحن: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
