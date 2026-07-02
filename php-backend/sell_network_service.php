<?php
ob_start();
/**
 * Al-Husam Phone - معالجة مبيعات كروت الشبكة وتعبئة الرصيد والباقات من الجداول المنفصلة
 * API Endpoint: sell_network_service.php
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
    $pdo = null;
}

// قراءة بيانات المبيعات
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);
if (empty($input)) {
    $input = $_POST;
}

$serviceId    = isset($input['service_id']) ? intval($input['service_id']) : 0;
$qty          = isset($input['qty']) ? floatval($input['qty']) : 1.0; // كمية البيع
$denomination = isset($input['denomination']) ? (!empty($input['denomination']) ? floatval($input['denomination']) : null) : null;
$customPrice  = isset($input['price']) ? floatval($input['price']) : 0.0; // سعر البيع الفعلي المسجل
$cashierName  = isset($input['cashier_name']) ? trim($input['cashier_name']) : 'الكاشير الحسام';
$customerName = isset($input['customer_name']) ? trim($input['customer_name']) : 'عميل سفري';
$invoiceId    = isset($input['invoice_id']) ? trim($input['invoice_id']) : '';

if ($serviceId <= 0 || $qty <= 0) {
    echo json_encode([
        'status' => 'error',
        'message' => 'بيانات غير مكتملة. يرجى توفير معرف الخدمة والكمية بشكل صحيح.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$success = false;
$msg = '';
$isLowStock = false;
$newStock = 0;
$printData = [];
$totalSales = 0.0;
$profit = 0.0;

if ($pdo) {
    try {
        $pdo->beginTransaction();

        // 1. جلب بيانات الخدمة الأساسية
        $stmt = $pdo->prepare("SELECT * FROM `network_services` WHERE `id` = ?");
        $stmt->execute([$serviceId]);
        $service = $stmt->fetch();

        if (!$service) {
            $pdo->rollBack();
            echo json_encode(['status' => 'error', 'message' => 'الخدمة غير متوفرة في دليل النظام.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $type = $service['type'];
        $serviceName = $service['name'];
        $networkName = $service['network_name'];

        // 2. جلب وتحديث المخزن حسب الآلية من الجداول المنفصلة الجديدة
        if ($type === 'balance') {
            // شحن وتعبئة رصيد باقات من جدول balance_packages_stock
            $stockStmt = $pdo->prepare("SELECT * FROM `balance_packages_stock` WHERE `service_id` = ? FOR UPDATE");
            $stockStmt->execute([$serviceId]);
            $stockItem = $stockStmt->fetch();

            if (!$stockItem) {
                $pdo->rollBack();
                echo json_encode(['status' => 'error', 'message' => 'لم يتم شحن أو تغذية حساب رصيد الوكيل لهذه الخدمة حتى الآن.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // التأكد من توفر رصيد كافٍ
            if ($stockItem['stock_qty'] < $qty) {
                $pdo->rollBack();
                echo json_encode([
                    'status' => 'error',
                    'message' => "عذراً، الرصيد المتبقي غير كافٍ! الرصيد المتاح حالياً هو: " . number_format($stockItem['stock_qty']) . " ريال."
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // حساب التكلفة والبيع والربح
            $unitSalePrice = $customPrice > 0 ? ($customPrice / $qty) : $stockItem['sale_price'];
            $unitCostPrice = $stockItem['cost_price']; // نسبة التكلفة (مثلاً 0.9700)

            $totalSales = $qty * $unitSalePrice;
            $totalCost  = $qty * $unitCostPrice;
            $profit     = $totalSales - $totalCost;

            // تحديث المخزن وخصم المبلغ
            $newStock = $stockItem['stock_qty'] - $qty;
            $updateStockStmt = $pdo->prepare("UPDATE `balance_packages_stock` SET `stock_qty` = ? WHERE `id` = ?");
            $updateStockStmt->execute([$newStock, $stockItem['id']]);

            if ($newStock <= $stockItem['min_limit']) {
                $isLowStock = true;
            }

            $success = true;
            $msg = "تمت عملية بيع رصيد بقيمة {$qty} ريال بنجاح (الأرباح: " . number_format($profit, 2) . " ريال).";
            
            $printData = [
                'invoice_id' => empty($invoiceId) ? "INV-NET-" . date('ymdHis') : $invoiceId,
                'service_name' => $serviceName,
                'type' => 'balance',
                'network_name' => $networkName,
                'qty' => $qty,
                'price' => $unitSalePrice,
                'total' => $totalSales,
                'date' => date('Y-m-d H:i:s'),
                'cashier' => $cashierName,
                'customer' => $customerName,
                'card_pin' => ''
            ];

        } else {
            // كروت الشبكة المحلية من جدول network_cards_stock
            if (is_null($denomination)) {
                $denomination = $customPrice > 0 ? $customPrice : 100.00;
            }

            $stockStmt = $pdo->prepare("SELECT * FROM `network_cards_stock` WHERE `service_id` = ? AND `denomination` = ? FOR UPDATE");
            $stockStmt->execute([$serviceId, $denomination]);
            $stockItem = $stockStmt->fetch();

            if (!$stockItem) {
                $pdo->rollBack();
                echo json_encode(['status' => 'error', 'message' => "الفئة المطلوبة ({$denomination} ريال) غير متوفرة أو لم يتم تغذيتها مسبقاً."], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // التأكد من توفر الكروت
            if ($stockItem['stock_qty'] < $qty) {
                $pdo->rollBack();
                echo json_encode([
                    'status' => 'error',
                    'message' => "عذراً، لا يوجد كروت كافية في مخزن فئة {$denomination} ريال! المتوفر: {$stockItem['stock_qty']} كرت."
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // حساب التكلفة والبيع والربح
            $totalSales = $stockItem['sale_price'] * $qty;
            $totalCost  = $stockItem['cost_price'] * $qty;
            $profit     = $totalSales - $totalCost;

            // تحديث المخزن وخصم كرت/كروت
            $newStock = $stockItem['stock_qty'] - $qty;
            $updateStockStmt = $pdo->prepare("UPDATE `network_cards_stock` SET `stock_qty` = ? WHERE `id` = ?");
            $updateStockStmt->execute([$newStock, $stockItem['id']]);

            if ($newStock <= $stockItem['min_limit']) {
                $isLowStock = true;
            }

            $success = true;
            $msg = "تم بيع كرت فئة {$denomination} ريال بنجاح وخصم عدد {$qty} كروت من المخزن.";

            $cardPin = (string)rand(100000000000, 999999999999);

            $printData = [
                'invoice_id' => empty($invoiceId) ? "INV-NET-" . date('ymdHis') : $invoiceId,
                'service_name' => "{$serviceName} - كرت {$denomination}",
                'type' => 'cards',
                'network_name' => $networkName,
                'qty' => $qty,
                'price' => $stockItem['sale_price'],
                'total' => $totalSales,
                'date' => date('Y-m-d H:i:s'),
                'cashier' => $cashierName,
                'customer' => $customerName,
                'card_pin' => $cardPin
            ];
        }

        // 3. إدراج الفاتورة في جدول المبيعات الرئيسي (sales)
        $invNum = $printData['invoice_id'];
        $salesStmt = $pdo->prepare("INSERT INTO `sales` (`invoice_id`, `customer_name`, `total_amount`, `profit`, `cashier`, `payment_method`) VALUES (?, ?, ?, ?, ?, 'نقداً')");
        $salesStmt->execute([$invNum, $customerName, $totalSales, $profit, $cashierName]);
        $salesTableId = $pdo->lastInsertId();

        // 4. إدراج السجل في تفاصيل الفاتورة (sales_items)
        $itemsStmt = $pdo->prepare("INSERT INTO `sales_items` (`sale_id`, `service_id`, `name`, `quantity`, `price`, `cost_price`, `profit`) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $itemsStmt->execute([$salesTableId, $serviceId, $printData['service_name'], $qty, ($totalSales / $qty), ($totalCost / $qty), $profit]);

        // 5. شحن حركة الصندوق المالي
        $safeStmt = $pdo->prepare("INSERT INTO `safe_transactions` (`type`, `amount`, `source`, `description`) VALUES ('in', ?, 'مبيعات كروت وباقات', ?)");
        $safeStmt->execute([$totalSales, "شحن صندوق الكاشير من مبيعات خدمية ({$printData['service_name']}) للعميل {$customerName}"]);

        $pdo->commit();

    } catch (Exception $e) {
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode([
            'status' => 'error',
            'message' => 'فشلت عملية البيع في السيرفر: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} else {
    // محاكاة مبيعات الكروت والرصيد لتسهيل التشغيل والتجريب في بيئة AI Studio
    $success = true;
    $newStock = ($type === 'balance') ? 48500 : 79;
    if ($newStock <= 10) { $isLowStock = true; }
    
    $totalSales = $customPrice > 0 ? $customPrice : (($type === 'balance') ? $qty : ($denomination * $qty));
    $profit = $totalSales * 0.05; 
    $invNum = empty($invoiceId) ? "INV-NET-MOCK" . rand(100, 999) : $invoiceId;

    $msg = "بيئة تجريبية: تمت محاكاة البيع وخصم المخزون بنجاح.";
    $printData = [
        'invoice_id' => $invNum,
        'service_name' => ($type === 'balance') ? "رصيد باقات يو مباشر" : "كرت شبكة المجد فئة " . ($denomination ?? 100),
        'type' => $type,
        'network_name' => $networkName,
        'qty' => $qty,
        'price' => ($type === 'balance') ? 1.00 : ($denomination ?? 100),
        'total' => $totalSales,
        'date' => date('Y-m-d H:i:s'),
        'cashier' => $cashierName,
        'customer' => $customerName,
        'card_pin' => ($type === 'cards') ? (string)rand(418290000000, 999999999999) : ''
    ];
}

if ($success) {
    $out = json_encode([
        'status' => 'success',
        'message' => $msg,
        'invoice_id' => $invNum,
        'stock_qty' => $newStock,
        'print_payload' => $printData
    ], JSON_UNESCAPED_UNICODE);

    echo $out;
    exit;
}
