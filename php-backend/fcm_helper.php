<?php
/**
 * Al-Husam Phone FCM v1 Notification Helper
 * يحمل دوال معتمدة لتوليد Access Token باستخدام JWT وإرسال الإشعارات الموجهة للأجهزة الفردية (Device Token).
 */
class FCMHelper {

    // --- إعدادات سحابية لـ Firebase ---
    // معرف مشروعك الفعلي من لوحة تحكم فايربيس
    private static $projectId = 'gen-lang-client-0621337551';
    
    // اسم ملف مفاتيح الخدمة لـ Firebase Admin SDK
    private static $serviceAccountFile = 'service-account.json';

    /**
     * توليد رمز الوصول لـ Google API عبر JWT يدوياً باستخدام ملف service-account.json
     * يعود بـ string (الرمز) في حال النجاح، أو false في حال الفشل مع تسجيل الخطأ في السجل.
     */
    private static function getOAuth2AccessToken() {
        try {
            $fileName = self::$serviceAccountFile;
            $possiblePaths = [
                __DIR__ . '/' . $fileName,
                dirname(__DIR__) . '/' . $fileName,
            ];
            if (isset($_SERVER['DOCUMENT_ROOT'])) {
                $possiblePaths[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/' . $fileName;
                $possiblePaths[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/php-backend/' . $fileName;
            }

            $jsonFilePath = '';
            foreach ($possiblePaths as $path) {
                if (file_exists($path)) {
                    $jsonFilePath = $path;
                    break;
                }
            }

            if (empty($jsonFilePath) || !file_exists($jsonFilePath)) {
                error_log("FCMHelper Error: Firebase service account file was not found under possible paths. Filename: {$fileName}");
                return false;
            }

            $jsonContent = @file_get_contents($jsonFilePath);
            if ($jsonContent === false) {
                error_log("FCMHelper Error: Failed to read Firebase service account file at: {$jsonFilePath}");
                return false;
            }
            
            $credentials = json_decode($jsonContent, true);
            if (!$credentials || !isset($credentials['private_key']) || !isset($credentials['client_email'])) {
                error_log("FCMHelper Error: Firebase service account file contains invalid JSON structure or is missing 'private_key' / 'client_email'.");
                return false;
            }

            $clientEmail = $credentials['client_email'];
            $privateKeyString = $credentials['private_key'];

            $privateKey = @openssl_pkey_get_private($privateKeyString);
            if (!$privateKey) {
                error_log("FCMHelper Error: Failed to parse Google Private Key. Please check the 'private_key' structure in your JSON.");
                return false;
            }
            
            $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
            $now = time();
            $payload = json_encode([
                'iss' => $clientEmail,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
                'aud' => 'https://oauth2.googleapis.com/token',
                'exp' => $now + 3600,
                'iat' => $now
            ]);
            
            $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
            $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
            $signatureInput = $base64UrlHeader . "." . $base64UrlPayload;
            
            if (!@openssl_sign($signatureInput, $signature, $privateKey, "SHA256")) {
                if (function_exists('openssl_free_key')) {
                    @openssl_free_key($privateKey);
                }
                error_log("FCMHelper Error: Cryptographic signing openssl_sign failed for JWT creation.");
                return false;
            }
            
            if (function_exists('openssl_free_key')) {
                @openssl_free_key($privateKey);
            }
            
            $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
            $jwt = $signatureInput . "." . $base64UrlSignature;
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt
            ]));
            $response = curl_exec($ch);
            curl_close($ch);
            
            if (!$response) {
                error_log("FCMHelper Error: Failed requesting OAuth2 token via cURL (empty response).");
                return false;
            }

            $responseData = json_decode($response, true);
            if (isset($responseData['access_token'])) {
                return $responseData['access_token'];
            } else {
                $errDesc = isset($responseData['error_description']) ? $responseData['error_description'] : (isset($responseData['error']) ? $responseData['error'] : 'Unknown error');
                error_log("FCMHelper Error: Google OAuth2 endpoint did not return access_token. Response: " . $response . " Description: " . $errDesc);
                return false;
            }
        } catch (Throwable $t) {
            error_log("FCMHelper Exception: " . $t->getMessage() . "\n" . $t->getTraceAsString());
            return false;
        }
    }

    /**
     * جلب كافة رموز الأجهزة (FCM Tokens) النشطة والمحدثة والمخزنة في قاعدة البيانات Firestore عبر REST API.
     * مع إمكانية استبعاد رمز المستخدم الحالي لتجنب إرسال إشعار للشخص نفسه الذي قام بالعملية.
     */
    public static function getActiveDeviceTokens($excludeUserId = null) {
        try {
            $accessToken = self::getOAuth2AccessToken();
            if (!$accessToken) {
                error_log("FCMHelper Error (getActiveDeviceTokens): Could not obtain OAuth2 authentication token.");
                return [];
            }

            $tokens = [];

            // 1. جلب التوكنات من مجموعة fcm_tokens
            $urlFcmTokens = "https://firestore.googleapis.com/v1/projects/" . self::$projectId . "/databases/(default)/documents/fcm_tokens";
            
            $ch1 = curl_init();
            curl_setopt($ch1, CURLOPT_URL, $urlFcmTokens);
            curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch1, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch1, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ]);
            $response1 = curl_exec($ch1);
            $httpCode1 = curl_getinfo($ch1, CURLINFO_HTTP_CODE);
            curl_close($ch1);

            if ($httpCode1 === 200 && $response1) {
                $data1 = json_decode($response1, true);
                if (!empty($data1) && isset($data1['documents'])) {
                    foreach ($data1['documents'] as $doc) {
                        if (!isset($doc['fields'])) {
                            continue;
                        }
                        $fields = $doc['fields'];
                        $token = isset($fields['token']['stringValue']) ? trim($fields['token']['stringValue']) : '';
                        $userId = isset($fields['userId']['stringValue']) ? trim($fields['userId']['stringValue']) : '';

                        if (empty($token)) {
                            continue;
                        }

                        // تجنب إرسال الإشعار لفاعل العملية نفسه إذا تم توفيره
                        if ($excludeUserId !== null && $userId === $excludeUserId) {
                            continue;
                        }

                        $tokens[] = $token;
                    }
                }
            } else {
                error_log("FCMHelper Info: Non-200 status code {$httpCode1} fetching fcm_tokens.");
            }

            // 2. جلب التوكنات من مجموعة users كـ Fallback احتياطي لرفع احتمالية التوصيل للأجهزة الأخرى والمدراء
            $urlUsers = "https://firestore.googleapis.com/v1/projects/" . self::$projectId . "/databases/(default)/documents/users";
            
            $ch2 = curl_init();
            curl_setopt($ch2, CURLOPT_URL, $urlUsers);
            curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch2, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ]);
            $response2 = curl_exec($ch2);
            $httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            curl_close($ch2);

            if ($httpCode2 === 200 && $response2) {
                $data2 = json_decode($response2, true);
                if (!empty($data2) && isset($data2['documents'])) {
                    foreach ($data2['documents'] as $doc) {
                        $docName = isset($doc['name']) ? $doc['name'] : '';
                        $userIdFromDocName = '';
                        if (!empty($docName)) {
                            $parts = explode('/', $docName);
                            $userIdFromDocName = end($parts);
                        }

                        if (!isset($doc['fields'])) {
                            continue;
                        }
                        $fields = $doc['fields'];
                        
                        $token = '';
                        if (isset($fields['fcmToken']['stringValue'])) {
                            $token = trim($fields['fcmToken']['stringValue']);
                        } elseif (isset($fields['token']['stringValue'])) {
                            $token = trim($fields['token']['stringValue']);
                        } elseif (isset($fields['fcm_token']['stringValue'])) {
                            $token = trim($fields['fcm_token']['stringValue']);
                        }

                        $userId = isset($fields['uid']['stringValue']) ? trim($fields['uid']['stringValue']) : $userIdFromDocName;

                        if (empty($token)) {
                            continue;
                        }

                        // تجنب إرسال الإشعار لفاعل العملية نفسه إذا تم توفيره
                        if ($excludeUserId !== null && $userId === $excludeUserId) {
                            continue;
                        }

                        $tokens[] = $token;
                    }
                }
            } else {
                error_log("FCMHelper Info: Non-200 status code {$httpCode2} fetching users.");
            }

            $uniqueTokens = array_values(array_unique(array_filter($tokens)));
            error_log("FCMHelper Active Tokens Found: " . count($uniqueTokens) . " total device tokens.");
            return $uniqueTokens;
        } catch (Exception $e) {
            error_log("FCMHelper Exception in getActiveDeviceTokens: " . $e->getMessage());
            return [];
        }
    }

    /**
     * إرسال إشعار سحابي مخصص إلى جهاز فردي باستخدام Device Token المباشر عبر FCM HTTP v1 API
     */
    public static function sendToDevice($deviceToken, $title, $body, $customData = []) {
        try {
            if (empty($deviceToken)) {
                error_log("FCMHelper Error: Device token is empty in sendToDevice call.");
                return ['success' => false, 'error' => 'Device token is empty'];
            }

            if (self::$projectId === 'YOUR_FIREBASE_PROJECT_ID') {
                error_log("FCMHelper Warning: Project ID is still set to 'YOUR_FIREBASE_PROJECT_ID'. Please replace it with your real project ID.");
                return ['success' => false, 'error' => 'Firebase Project ID is not configured'];
            }

            $accessToken = self::getOAuth2AccessToken();
            if (!$accessToken) {
                error_log("FCMHelper Error: Could not obtain OAuth2 authentication token to speak with FCM.");
                return ['success' => false, 'error' => 'Authorization failed'];
            }

            $url = "https://fcm.googleapis.com/v1/projects/" . self::$projectId . "/messages:send";
            
            // حقن قنوات الصوت الافتراضية والنوعية لـ Capacitor وأندرويد لدمج الصوت والاهتزاز
            $payload = [
                'message' => [
                    'token' => $deviceToken,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                        'sound' => 'default'
                    ],
                    'data' => array_merge([
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                        'sound' => 'default'
                    ], $customData),
                    'android' => [
                        'notification' => [
                            'sound' => 'default',
                            'notification_priority' => 'PRIORITY_HIGH',
                            'channel_id' => 'fcm_default_channel'
                        ]
                    ]
                ]
            ];
            
            $headers = [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ];
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            $success = ($httpCode == 200 || $httpCode == 201);
            if (!$success) {
                error_log("FCMHelper Send Error: HTTP status {$httpCode}. Raw Response: {$response}");
            }

            return ['success' => $success, 'http_code' => $httpCode, 'response' => $response];
        } catch (Exception $e) {
            error_log("FCMHelper Send Exception: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * إرسال إشعار سحابي إلى Topic معين (مثل البث لجميع الموظفين المكتتبين)
     * يدعم FCM HTTP v1 API
     */
    public static function sendToTopic($topicName, $title, $body, $customData = []) {
        try {
            $accessToken = self::getOAuth2AccessToken();
            if (!$accessToken) {
                error_log("FCMHelper Error: Could not obtain OAuth2 authentication token.");
                return ['success' => false, 'error' => 'Authorization failed'];
            }

            $url = "https://fcm.googleapis.com/v1/projects/" . self::$projectId . "/messages:send";

            $payload = [
                'message' => [
                    'topic' => $topicName,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                        'sound' => 'default'
                    ],
                    'data' => array_merge([
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                        'sound' => 'default'
                    ], $customData),
                    'android' => [
                        'notification' => [
                            'sound' => 'default',
                            'notification_priority' => 'PRIORITY_HIGH',
                            'channel_id' => 'fcm_default_channel'
                        ]
                    ]
                ]
            ];

            $headers = [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ];

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $success = ($httpCode == 200 || $httpCode == 201);
            if (!$success) {
                error_log("FCMHelper Topic Send Error: HTTP status {$httpCode}. Raw Response: {$response}");
            }

            return ['success' => $success, 'http_code' => $httpCode, 'response' => $response];
        } catch (Exception $e) {
            error_log("FCMHelper Topic Send Exception: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}