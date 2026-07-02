<?php
ob_start();
/**
 * Al-Husam Phone - إضافة صنف جديد للمخزن وإرسال إشعار فوري لجميع الموظفين
 */
header('Content-Type: application/json; charset=utf-8');
require_once 'fcm_helper.php';

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (empty($input)) {
    $input = $_POST;
}

$itemName = isset($input['item_name']) ? htmlspecialchars($input['item_name']) : 'منتج جديد';
$stock = isset($input['stock']) ? floatval($input['stock']) : 0;
$unit = isset($input['unit']) ? htmlspecialchars($input['unit']) : 'قطعة';

// --- بداية كود منطق حفظ الصنف في قاعدة البيانات الخلفية ---
//
// $db->query("INSERT INTO items ...");
//
// --- نهاية كود منطق حفظ الصنف في قاعدة البيانات ---

// عند نجاح العملية في قاعدة البيانات:
$success = true; // نفترض نجاح العملية بنجاح لتوضيح تدفق الإشعار

if ($success) {
    // إرسال الإشعار السحابي فورا لقناة "جميع الموظفين" ببيانات الصنف الجديد
    $title = "📦 صنف جديد بالمستودع";
    $body = "تم إضافة منتج جديد: {$itemName} بقوة كمية ابتدائية ({$stock} {$unit})";
    
    $fcmResult = FCMHelper::sendToTopic('all_staff', $title, $body, [
        'type' => 'new_item',
        'item_name' => $itemName,
        'stock' => (string)$stock,
        'unit' => $unit
    ]);

    $out = json_encode([
        'status' => 'success',
        'message' => 'تم حفظ الصنف الجديد بنجاح وإرسال الإشعار السحابي.',
        'fcm_notification' => $fcmResult
    ], JSON_UNESCAPED_UNICODE);
    ob_clean();
    echo $out;
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
