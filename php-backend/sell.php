<?php
ob_start();
/**
 * Al-Husam Phone - تسجيل عملية مبيعات جديدة وإرسال إشعار فوري لجميع الموظفين
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'fcm_helper.php';

// فرضية استلام البيانات المرسلة عبر API (مثلاً بصيغة JSON)
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

// في حال كانت البيانات كمتغيرات POST عادية
if (empty($input)) {
    $input = $_POST;
}

$totalAmount = isset($input['total_amount']) ? floatval($input['total_amount']) : 0;
$currency = 'ريال يمني';
$invoiceId = isset($input['invoice_id']) ? htmlspecialchars($input['invoice_id']) : '';

// --- بداية كود منطق تخزين وحفظ الفاتورة وقص الكمية في قاعدة البيانات الخلفية ---
//
// $db->query("INSERT INTO invoices ...");
//
// --- نهاية كود منطق تخزين وحفظ الفاتورة وقص الكمية ---

// عند نجاح العملية في قاعدة البيانات:
$success = true; // نفترض نجاح العملية بنجاح لتوضيح تدفق الإشعار

if ($success) {
    // 1. تحضير الاستجابة السريعة للمستخدم لمنع أي بطء في الواجهة
    $out = json_encode([
        'status' => 'success',
        'message' => 'تم تسجيل المبيعات بنجاح، ويجري إرسال الإشعارات السحابية في الخلفية.'
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
    $title = "🛒 عملية مبيعات جديدة";
    $body = "تم تسجيل مبيعات جديدة بقيمة " . number_format($totalAmount, 2) . " " . $currency;
    if (!empty($invoiceId)) {
        $body .= " (رقم الفاتورة: {$invoiceId})";
    }
    
    // جلب معرف المستخدم الحالي لفاعل العملية (إذا تم تمريره في الطلب) لاستبعاده من استلام الإشعار عن نفسه
    $currentUserId = isset($input['user_id']) ? htmlspecialchars($input['user_id']) : (isset($input['userId']) ? htmlspecialchars($input['userId']) : null);
    
    // جلب التوكنات النشطة للهواتف الأخرى من قاعدة البيانات (Firestore fcm_tokens)
    $deviceTokens = FCMHelper::getActiveDeviceTokens($currentUserId);
    
    $fcmResults = [];
    if (!empty($deviceTokens)) {
        foreach ($deviceTokens as $token) {
            $fcmRawResult = FCMHelper::sendToDevice($token, $title, $body, [
                'type' => 'sale',
                'total_amount' => (string)$totalAmount,
                'currency' => $currency,
                'invoice_id' => $invoiceId
            ]);
            $fcmResults[] = [
                'token' => substr($token, 0, 15) . '...',
                'result' => $fcmRawResult
            ];
        }
    } else {
        // في حال لم تكن هناك أجهزة مسجلة في Firestore fcm_tokens، نقوم بالإرسال للقناة كـ Fallback احتياطي
        $fcmRawResult = FCMHelper::sendToTopic('all_staff', $title, $body, [
            'type' => 'sale',
            'total_amount' => (string)$totalAmount,
            'currency' => $currency,
            'invoice_id' => $invoiceId
        ]);
        $fcmResults[] = [
            'fallback_topic' => 'all_staff',
            'result' => $fcmRawResult
        ];
    }

    error_log("FCM Background process completed. Results: " . json_encode($fcmResults));
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
