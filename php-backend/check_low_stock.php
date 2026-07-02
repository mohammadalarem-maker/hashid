<?php
ob_start();
/**
 * Al-Husam Phone - فحص كمية المنتج وهبوطها عن الحد المسموح ومخاطبة الطاقم بإشعار سحابي ذكي
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'fcm_helper.php';

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (empty($input)) {
    $input = $_POST;
}

$itemName = isset($input['item_name']) ? htmlspecialchars($input['item_name']) : '';
$currentStock = isset($input['current_stock']) ? floatval($input['current_stock']) : 0;
$minStock = isset($input['min_stock']) ? floatval($input['min_stock']) : 5;
$unit = isset($input['unit']) ? htmlspecialchars($input['unit']) : 'قطعة';

if (empty($itemName)) {
    $out = json_encode([
        'status' => 'error',
        'message' => 'اسم الصنف حقل مطلوب للفحص.'
    ], JSON_UNESCAPED_UNICODE);
    ob_clean();
    echo $out;
    exit;
}

// فحص هبوط الكمية عن الحد الأدنى المسموح
$isBelowMinimum = ($currentStock <= $minStock);

if ($isBelowMinimum) {
    // 1. تحضير الاستجابة السريعة للمستخدم لمنع أي بطء في الواجهة
    $out = json_encode([
        'status' => 'success',
        'is_low_stock' => true,
        'message' => 'تم رصد هبوط المخزون بنجاح، ويجري إرسال إشعار التنبيه في الخلفية.'
    ], JSON_UNESCAPED_UNICODE);

    // إرسال الهيدرات لإغلاق الاتصال فورا مع المتصفح
    ignore_user_abort(true);
    set_time_limit(120); // مهلة كافية للخلفية

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

    // --- الآن، كود الإشعارات يعمل بالكامل في الخلفية دون تعطيل الكاشير ---
    $title = "🚨 تنبيه: مخزون منخفض جداً!";
    $body = "الصنف ({$itemName}) قارب على النفاد! المتبقي حالياً: {$currentStock} {$unit} فقط (الحد الأدنى: {$minStock} {$unit})";
    
    $fcmResult = FCMHelper::sendToTopic('all_staff', $title, $body, [
        'type' => 'low_stock_warning',
        'item_name' => $itemName,
        'current_stock' => (string)$currentStock,
        'min_stock' => (string)$minStock,
        'unit' => $unit
    ]);

    error_log("FCM Low Stock Background process completed. Result: " . json_encode($fcmResult));
    exit;
} else {
    $out = json_encode([
        'status' => 'success',
        'is_low_stock' => false,
        'message' => 'الكمية في النطاق الآمن.'
    ], JSON_UNESCAPED_UNICODE);
    ob_clean();
    echo $out;
    exit;
}
