<?php
ob_start();
/**
 * Al-Husam Phone - إضافة دين جديد للعميل وإرسال إشعار فوري لجميع الموظفين والمدير
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'fcm_helper.php';

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (empty($input)) {
    $input = $_POST;
}

$customerName = isset($input['customer_name']) ? htmlspecialchars($input['customer_name']) : 'عميل غير معروف';
$amount = isset($input['amount']) ? floatval($input['amount']) : 0;
$currency = 'ريال يمني';

// --- بداية كود منطق حفظ وإضافة الدين في قاعدة البيانات الخلفية ---
//
// $db->query("INSERT INTO debts ...");
//
// --- نهاية كود منطق حفظ وإضافة الدين في قاعدة البيانات ---

// عند نجاح العملية في قاعدة البيانات:
$success = true; // نفترض نجاح العملية بنجاح لتوضيح تدفق الإشعار

if ($success) {
    // 1. تحضير الاستجابة السريعة للمستخدم لمنع أي بطء في الواجهة
    $out = json_encode([
        'status' => 'success',
        'message' => 'تم تسجيل الدين بنجاح، ويجري إرسال الإشعار السحابي في الخلفية.'
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
    $title = "💸 تسجيل دين جديد";
    $body = "تم تسجيل دين جديد على العميل ({$customerName}) بمبلغ " . number_format($amount, 2) . " " . $currency;
    
    $fcmResult = FCMHelper::sendToTopic('all_staff', $title, $body, [
        'type' => 'debt',
        'customer_name' => $customerName,
        'amount' => (string)$amount,
        'currency' => $currency
    ]);

    error_log("FCM Debt Background process completed. Result: " . json_encode($fcmResult));
    exit;
} else {
    $out = json_encode([
        'status' => 'error',
        'message' => 'أخفقت عملية الحفظ.'
    ], JSON_UNESCAPED_UNICODE);
    ob_clean();
    echo $out;
    exit;
}
