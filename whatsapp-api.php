<?php
/**
 * WhatsApp API Service - GREEN API VERSION
 * Location: /app/api/whatsapp-api.php
 * Version: 11.0 - Refactored for efficiency and centralization
 * * תומך בכל סוגי ההתראות עם Green API + מערכת תזכורות מתקדמת
 */

// הגדר אזור זמן לישראל
date_default_timezone_set('Asia/Jerusalem');

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ========================================
// הגדרות Green API - החלף את הערכים כאן
// ========================================
define('GREEN_API_INSTANCE', '7105302600'); // ה-Instance ID שלך
define('GREEN_API_TOKEN', 'bb12357af3e647b7a48e7b744cc57db5620065d9f9d8493197'); // הטוקן שלך
define('GREEN_API_URL', 'https://7105.api.greenapi.com'); // URL בסיס

// ========================================
// טעינת הגדרות ופונקציות מרכזיות
// ========================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api.php';


// לוג מפורט
function writeLog($message, $data = null) {
    $logFile = __DIR__ . '/whatsapp_log_' . date('Y-m-d') . '.txt';
    $time = date('Y-m-d H:i:s');
    $logEntry = "[$time] $message";
    if ($data) {
        $logEntry .= " | DATA: " . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    file_put_contents($logFile, $logEntry . "\n", FILE_APPEND);
}

/**
 * שלח הודעת WhatsApp דרך Green API
 */
function sendWhatsAppMessage($phone, $message, $context = '') {
    $originalPhone = $phone;
    
    // ניקוי וסטנדרטיזציה של מספר הטלפון
    $phone = preg_replace('/[^0-9]/', '', $phone);
    
    // המרה לפורמט בינלאומי
    if (substr($phone, 0, 1) == '0') {
        $phone = '972' . substr($phone, 1);
    } elseif (substr($phone, 0, 3) != '972') {
        $phone = '972' . $phone;
    }
    
    // פורמט Green API דורש @c.us בסוף
    $chatId = $phone . '@c.us';
    
    writeLog("Sending WhatsApp via Green API", [
        'to' => $chatId,
        'original' => $originalPhone,
        'context' => $context,
        'message_length' => strlen($message)
    ]);
    
    // בניית URL לשליחת הודעה
    $url = GREEN_API_URL . "/waInstance" . GREEN_API_INSTANCE . "/sendMessage/" . GREEN_API_TOKEN;
    
    // נתוני ההודעה
    $data = [
        "chatId" => $chatId,
        "message" => $message
    ];
    
    // שליחה עם CURL
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json"
        ],
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        writeLog("CURL Error", ['error' => $error]);
        return ['success' => false, 'error' => $error];
    }
    
    $result = json_decode($response, true);
    
    // Green API מחזיר 200 עם idMessage כשההודעה נשלחה בהצלחה
    $success = ($httpCode == 200 && isset($result['idMessage']));
    
    writeLog($success ? "Success" : "Failed", [
        'response' => $result,
        'http_code' => $httpCode,
        'message_id' => $result['idMessage'] ?? null
    ]);
    
    return [
        'success' => $success,
        'response' => $result,
        'context' => $context,
        'message_id' => $result['idMessage'] ?? null,
        'error' => $success ? null : ($result['error'] ?? 'Unknown error')
    ];
}

/**
 * בדוק סטטוס של Green API Instance
 */
function checkGreenAPIStatus() {
    $url = GREEN_API_URL . "/waInstance" . GREEN_API_INSTANCE . "/getStateInstance/" . GREEN_API_TOKEN;
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode == 200) {
        return json_decode($response, true);
    }
    
    return ['stateInstance' => 'unknown', 'error' => 'Failed to get status'];
}

/**
 * קבל פרטי לקוח מ-Airtable (משתמש בפונקציה המרכזית)
 */
function getClientFromAirtable($clientId) {
    if (empty($clientId)) return null;
    $url = AIRTABLE_API_URL . 'Clients/' . $clientId;
    try {
        $data = airtableRequest($url);
        return $data['fields'] ?? null;
    } catch (Exception $e) {
        writeLog("Failed to get client from Airtable", [
            'client_id' => $clientId,
            'error' => $e->getMessage()
        ]);
        return null;
    }
}

/**
 * קבל הזמנות לתאריך ספציפי עם פרטי לקוח מלאים (בצורה יעילה)
 */
function getBookingsForDate($date) {
    writeLog("Getting bookings for date", ['date' => $date]);
    
    $formula = urlencode("AND({Date} = '{$date}', NOT({Status} = 'בוטל'))");
    $url = AIRTABLE_API_URL . urlencode('Bookings') . '?filterByFormula=' . $formula;

    try {
        $data = airtableRequest($url);
    } catch (Exception $e) {
        writeLog("Failed to get bookings", ['error' => $e->getMessage()]);
        return [
            'success' => false,
            'error' => 'Failed to fetch bookings from Airtable',
            'count' => 0,
            'bookings' => []
        ];
    }

    $bookings = $data['records'] ?? [];
    writeLog("Raw bookings found", ['count' => count($bookings)]);
    
    $processedBookings = [];
    foreach ($bookings as $booking) {
        $fields = $booking['fields'];
        
        // השתמש בשדה ה-lookup לקבלת הטלפון ישירות
        $phone = $fields['Phone Number'][0] ?? null;
        if (empty($phone)) {
            writeLog("Booking without phone number in lookup", ['booking_id' => $booking['id']]);
            continue; // דלג על הזמנה ללא טלפון
        }

        // השתמש בשדה ה-lookup לקבלת שם הלקוח
        $clientName = $fields['Client Name Lookup'][0] ?? 'לא ידוע';

        $processedBooking = [
            'id' => $booking['id'],
            'client_id' => ($fields['Client Link'][0] ?? null),
            'client_name' => $clientName,
            'phone' => $phone,
            'time' => $fields['Time'] ?? 'לא צוין',
            'cars' => $fields['Number of Cars'] ?? '1', // תוקן לסוג string
            'status' => $fields['Status'] ?? 'ממתין לאישור',
            'notes' => $fields['Notes'] ?? '',
            'address' => ($fields['Address'][0] ?? ''), // lookup מחזיר מערך
            'city' => ($fields['City'][0] ?? '') // lookup מחזיר מערך
        ];
        
        $processedBookings[] = $processedBooking;
        
        writeLog("Processed booking directly from lookup", [
            'client' => $processedBooking['client_name'],
            'phone' => $processedBooking['phone']
        ]);
    }
    
    writeLog("Final processed bookings", ['count' => count($processedBookings)]);
    
    return [
        'success' => true,
        'count' => count($processedBookings),
        'bookings' => $processedBookings
    ];
}


/**
 * קבל הזמנות למחר
 */
function getTomorrowBookings() {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    return getBookingsForDate($tomorrow);
}

/**
 * פורמט תאריך לעברית
 */
function formatHebrewDate($date) {
    $timestamp = strtotime($date);
    $days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    $months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
               'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    
    $dayName = $days[date('w', $timestamp)];
    $day = date('j', $timestamp);
    $month = $months[date('n', $timestamp) - 1];
    $year = date('Y', $timestamp);
    
    return "יום {$dayName}, {$day} ב{$month} {$year}";
}

/**
 * בנה הודעת תזכורת עם כל הפרטים
 */
function buildReminderMessage($booking, $date) {
    $hebrewDate = formatHebrewDate($date);
    
    $message = "🔔 תזכורת מקאר וושר

שלום {$booking['client_name']},

מזכירים לך על הזמנת הרחיצה שלך מחר:

📅 תאריך: {$hebrewDate}
⏰ שעה: {$booking['time']}
🚗 מספר כלי רכב: {$booking['cars']}";

    // הוסף כתובת אם יש
    if (!empty($booking['address'])) {
        $message .= "\n📍 כתובת: {$booking['address']}";
        if (!empty($booking['city'])) {
            $message .= ", {$booking['city']}";
        }
    }
    
    // הוסף הערות אם יש
    if (!empty($booking['notes'])) {
        $message .= "\n💬 הערות: {$booking['notes']}";
    }
    
    $message .= "

אנא הקפידו להכין את הרכב לרחיצה:
• חנו אותו במקום מוצל או מקורה
• ודאו גישה נוחה לרכב
• במקרה של ביטול - נא ליצור קשר מראש

נשמח לראותכם מחר! 🚗✨

צוות קאר וושר
📞 ליצירת קשר: 054-995-2960";
    
    return $message;
}

// ====================
// טיפול בבקשות
// ====================

$action = $_GET['action'] ?? $_POST['action'] ?? '';
writeLog("API Request", ['action' => $action, 'method' => $_SERVER['REQUEST_METHOD']]);

$input = json_decode(file_get_contents('php://input'), true);

switch($action) {
    
    // ===== NEW ACTIONS FOR PENDING BOOKINGS =====
    case 'send_pending_confirmation_to_client':
        $clientName = $input['clientName'] ?? 'לקוח/ה יקר/ה';
        $clientPhone = $input['clientPhone'] ?? '';
        $date = $input['date'] ?? '';
        $time = $input['time'] ?? '';

        if (empty($clientPhone) || empty($date) || empty($time)) {
            echo json_encode(['success' => false, 'error' => 'Missing data for client notification.']);
            exit;
        }
        
        $formattedDate = date("d/m/Y", strtotime($date));
        
        $message = "היי {$clientName} 👋\n\n";
        $message .= "קיבלנו את בקשתך לתיאום תור!\n\n";
        $message .= "פרטי הבקשה:\n";
        $message .= "📅 תאריך: {$formattedDate}\n";
        $message .= "⏰ שעה: {$time}\n\n";
        $message .= "ההזמנה ממתינה כעת לאישור סופי ממנהל היומן 🗓️✅\n";
        $message .= "ניצור איתך קשר בהקדם האפשרי לאישור.\n\n";
        $message .= "תודה שבחרת בקאר וושר! 🚙💦";

        $result = sendWhatsAppMessage($clientPhone, $message, 'pending_confirmation_client');
        echo json_encode($result);
        break;

    case 'send_pending_notification_to_manager':
        $managerPhone = '972549952960'; // Manager's number
        
        $clientName = $input['clientName'] ?? 'לקוח לא ידוע';
        $clientPhone = $input['clientPhone'] ?? 'לא נמסר';
        $date = $input['date'] ?? '';
        $time = $input['time'] ?? '';
        
        if (empty($date) || empty($time)) {
            echo json_encode(['success' => false, 'error' => 'Missing data for manager notification.']);
            exit;
        }

        $formattedDate = date("d/m/Y", strtotime($date));
        
        $message = "🔔 התראה: התקבלה בקשה חדשה לתיאום תור.\n\n👤 שם: {$clientName}\n📞 טלפון: {$clientPhone}\n🗓️ תאריך: {$formattedDate}\n⏰ שעה: {$time}\n\nהבקשה ממתינה לאישורך במערכת ניהול היומן.";

        $result = sendWhatsAppMessage($managerPhone, $message, 'pending_notification_manager');
        echo json_encode($result);
        break;

    // ===== EXISTING ACTIONS =====
    
    case 'send_new_client_with_pin':
        $clientId = $input['clientId'] ?? '';
        $pinCode = $input['pinCode'] ?? '';
        $bookingDate = $input['date'] ?? '';
        $bookingTime = $input['time'] ?? '';
        $numberOfCars = $input['numberOfCars'] ?? 1;
        
        if (!$clientId || !$pinCode) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID or PIN']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "🎉 ברוכים הבאים לקאר וושר!\n\n";
        $message .= "📱 פרטי הכניסה שלך לאזור האישי:\n";
        $message .= "🔢 קוד PIN: {$pinCode}\n";
        $message .= "📞 טלפון: {$client['Phone Number']}\n";
        $message .= "🔗 לינק לכניסה: https://carwasher.co.il/app/client/\n\n";
        $message .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "✅ ההזמנה שלך התקבלה בהצלחה!\n\n";
        $message .= "📅 תאריך: " . formatHebrewDate($bookingDate) . "\n";
        $message .= "⏰ שעה: {$bookingTime}\n";
        
        if (!empty($client['Address'])) {
            $message .= "📍 כתובת: {$client['Address']}";
            if (!empty($client['City'])) {
                $message .= ", {$client['City']}";
            }
            $message .= "\n";
        }
        
        if ($numberOfCars > 1) {
            $message .= "🚗 מספר רכבים: {$numberOfCars}\n";
        }
        
        $message .= "\nנשמח לראותך!\n";
        $message .= "צוות קאר וושר 🚙💦\n\n";
        $message .= "💡 טיפ: שמור הודעה זו עם פרטי הכניסה שלך";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'new_client_with_pin');
        echo json_encode($result);
        break;
        
    case 'send_booking_confirmation':
        $clientId = $input['clientId'] ?? '';
        $bookingDate = $input['date'] ?? '';
        $bookingTime = $input['time'] ?? '';
        $numberOfCars = $input['numberOfCars'] ?? 1;
        $notes = $input['notes'] ?? '';
        
        if (!$clientId) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "✅ ההזמנה שלך התקבלה בהצלחה!\n\n";
        $message .= "📅 תאריך: " . formatHebrewDate($bookingDate) . "\n";
        $message .= "⏰ שעה: {$bookingTime}\n";
        
        if (!empty($client['Address'])) {
            $message .= "📍 כתובת: {$client['Address']}";
            if (!empty($client['City'])) {
                $message .= ", {$client['City']}";
            }
            $message .= "\n";
        }
        
        if ($numberOfCars > 1) {
            $message .= "🚗 מספר רכבים: {$numberOfCars}\n";
        }
        
        if ($notes) {
            $message .= "💬 הערות: {$notes}\n";
        }
        
        $message .= "\nנשמח לראותך!\n";
        $message .= "צוות קאר וושר 🚙💦";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'booking_confirmation');
        echo json_encode($result);
        break;
        
    case 'send_booking_update':
        $clientId = $input['clientId'] ?? '';
        $bookingDate = $input['date'] ?? '';
        $bookingTime = $input['time'] ?? '';
        $numberOfCars = $input['numberOfCars'] ?? 1;
        $notes = $input['notes'] ?? '';
        
        if (!$clientId) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "🔄 ההזמנה שלך עודכנה בהצלחה!\n\n";
        $message .= "📅 תאריך מעודכן: " . formatHebrewDate($bookingDate) . "\n";
        $message .= "⏰ שעה מעודכנת: {$bookingTime}\n";
        
        if ($numberOfCars) {
            $message .= "🚗 מספר רכבים: {$numberOfCars}\n";
        }
        
        if ($notes) {
            $message .= "💬 הערות: {$notes}\n";
        }
        
        $message .= "\nנשמח לראותך!\n";
        $message .= "צוות קאר וושר 🚙💦";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'booking_update');
        echo json_encode($result);
        break;
        
    case 'send_booking_cancellation':
        $clientId = $input['clientId'] ?? '';
        $bookingDate = $input['date'] ?? '';
        $bookingTime = $input['time'] ?? '';
        
        if (!$clientId) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "❌ ההזמנה שלך בוטלה.\n\n";
        $message .= "📅 תאריך שבוטל: " . formatHebrewDate($bookingDate) . "\n";
        $message .= "⏰ שעה שבוטלה: {$bookingTime}\n\n";
        $message .= "ניתן לקבוע תור חדש בכל עת.\n";
        $message .= "צוות קאר וושר 🚙💦";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'booking_cancellation');
        echo json_encode($result);
        break;
        
    case 'send_recurring_limited':
        $clientId = $input['clientId'] ?? '';
        $dates = $input['dates'] ?? []; // רק 3 תאריכים
        $bookingTime = $input['time'] ?? '';
        $numberOfCars = $input['numberOfCars'] ?? 1;
        $frequency = $input['frequency'] ?? 'שבועי';
        
        if (!$clientId || empty($dates)) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID or dates']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "✅ נקבע לך תיאום קבוע {$frequency}!\n\n";
        $message .= "📅 הפגישות הקרובות:\n";
        
        foreach ($dates as $index => $date) {
            $message .= ($index + 1) . ". " . formatHebrewDate($date) . "\n";
        }
        
        $message .= "\n...וכך הלאה באופן {$frequency}\n";
        $message .= "⏰ שעה קבועה: {$bookingTime}\n";
        
        if ($numberOfCars > 1) {
            $message .= "🚗 מספר רכבים: {$numberOfCars}\n";
        }
        
        $message .= "\nנשמח לראותך!\n";
        $message .= "צוות קאר וושר 🚙💦";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'recurring_limited');
        echo json_encode($result);
        break;

    case 'send_booking_upgraded_to_recurring':
        $clientId = $input['clientId'] ?? '';
        $startDateStr = $input['date'] ?? '';
        $time = $input['time'] ?? '';
        $frequency = $input['frequency'] ?? 'weekly';
        
        if (!$clientId || !$startDateStr || !$time) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID, date, or time']);
            break;
        }

        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            break;
        }

        $clientName = $client['Full Name'] ?? '';
        $phone = $client['Phone Number'] ?? '';

        $nextDates = [];
        try {
            $currentDate = new DateTime($startDateStr);
            $intervalStr = ($frequency === 'biweekly') ? 'P2W' : 'P1W';
            $interval = new DateInterval($intervalStr);

            for ($i = 0; $i < 3; $i++) {
                $nextDates[] = formatHebrewDate($currentDate->format('Y-m-d'));
                $currentDate->add($interval);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Invalid date format: ' . $e->getMessage()]);
            break;
        }
        
        $hebrewFrequency = ($frequency === 'biweekly') ? 'דו-שבועי' : 'שבועי';

        $messageBody = "שלום {$clientName} 👋\n\n";
        $messageBody .= "✅ התיאום שלך שודרג בהצלחה לתיאום {$hebrewFrequency}!\n\n";
        $messageBody .= "להלן שלושת המועדים הקרובים שלך:\n";
        $messageBody .= "📅 " . $nextDates[0] . "\n";
        $messageBody .= "📅 " . $nextDates[1] . "\n";
        $messageBody .= "📅 " . $nextDates[2] . "\n";
        $messageBody .= "\n...וכך הלאה, באותה השעה ({$time}).\n\n";
        $messageBody .= "נשמח לראותך!\n";
        $messageBody .= "צוות קאר וושר 🚙💦";

        $result = sendWhatsAppMessage($phone, $messageBody, 'booking_upgraded_to_recurring'); 
        
        echo json_encode($result);
        break;
        
    case 'send_subscription_update':
        $clientId = $input['clientId'] ?? '';
        $totalWashes = $input['totalWashes'] ?? 0;
        $remainingWashes = $input['remainingWashes'] ?? 0;
        
        if (!$clientId) {
            echo json_encode(['success' => false, 'error' => 'Missing client ID']);
            exit;
        }
        
        $client = getClientFromAirtable($clientId);
        if (!$client) {
            echo json_encode(['success' => false, 'error' => 'Client not found']);
            exit;
        }
        
        $usedWashes = $totalWashes - $remainingWashes;
        
        $message = "שלום {$client['Full Name']} 👋\n\n";
        $message .= "📊 עדכון מצב הכרטיסייה שלך:\n\n";
        $message .= "✅ נוצלו: {$usedWashes} שטיפות\n";
        $message .= "📌 נותרו: {$remainingWashes} שטיפות\n";
        $message .= "📋 סה\"כ במנוי: {$totalWashes} שטיפות\n\n";
        
        if ($remainingWashes == 0) {
            $message .= "⚠️ שים לב! הכרטיסייה שלך הסתיימה.\n\n";
            $message .= "לחידוש המנוי:\n";
            $message .= "📱 פייבוקס: 054-995-2960\n";
            $message .= "💳 תשלום אונליין: https://pay.grow.link/cd84ac7b14e593cb4522049c4c9742cd-MTk2MjQ2OQ\n\n";
        } elseif ($remainingWashes <= 2) {
            $message .= "⚠️ שים לב - נותרו לך רק {$remainingWashes} שטיפות!\n";
            $message .= "מומלץ לחדש את המנוי בקרוב.\n\n";
        }
        
        $message .= "תודה שבחרת בקאר וושר! 🚙💦";
        
        $result = sendWhatsAppMessage($client['Phone Number'], $message, 'subscription_update');
        echo json_encode($result);
        break;
        
    case 'send_daily_reminders':
        writeLog("Starting daily reminders process");
        
        $tomorrow = date('Y-m-d', strtotime('+1 day'));
        $bookingsResult = getTomorrowBookings();
        
        if (!$bookingsResult['success']) {
            echo json_encode([
                'success' => false,
                'error' => 'Failed to get tomorrow bookings',
                'date' => $tomorrow
            ]);
            break;
        }
        
        $bookings = $bookingsResult['bookings'];
        $results = [];
        $successCount = 0;
        $failCount = 0;
        
        writeLog("Found bookings for tomorrow", ['count' => count($bookings)]);
        
        foreach ($bookings as $booking) {
            if (!$booking['phone']) {
                $failCount++;
                $results[] = [
                    'client' => $booking['client_name'],
                    'phone' => 'לא ידוע',
                    'time' => $booking['time'],
                    'cars' => $booking['cars'],
                    'success' => false,
                    'error' => 'אין מספר טלפון'
                ];
                continue;
            }
            
            $message = buildReminderMessage($booking, $tomorrow);
            $result = sendWhatsAppMessage($booking['phone'], $message, 'daily_reminder');
            
            if ($result['success']) {
                $successCount++;
            } else {
                $failCount++;
            }
            
            $results[] = [
                'client' => $booking['client_name'],
                'phone' => $booking['phone'],
                'time' => $booking['time'],
                'cars' => $booking['cars'],
                'success' => $result['success'],
                'error' => $result['error'] ?? null
            ];
            
            sleep(1);
        }
        
        writeLog("Daily reminders complete", [
            'success' => $successCount,
            'failed' => $failCount
        ]);
        
        echo json_encode([
            'success' => true,
            'date' => $tomorrow,
            'sent' => $successCount + $failCount,
            'successful' => $successCount,
            'failed' => $failCount,
            'total_bookings' => count($bookings),
            'details' => $results
        ]);
        break;
        
    case 'send_custom':
        $phone = $input['phone'] ?? '';
        $message = $input['message'] ?? '';
        
        if (!$phone || !$message) {
            echo json_encode(['success' => false, 'error' => 'Missing phone or message']);
            exit;
        }
        
        $result = sendWhatsAppMessage($phone, $message, 'custom_message');
        echo json_encode($result);
        break;
        
    case 'test':
        $status = checkGreenAPIStatus();
        
        echo json_encode([
            'success' => true,
            'message' => 'Green API is configured!',
            'time' => date('Y-m-d H:i:s'),
            'timezone' => date_default_timezone_get(),
            'server' => 'Car Washer WhatsApp Service v11.0 - Refactored',
            'configuration' => [
                'provider' => 'Green API',
                'instance_id' => GREEN_API_INSTANCE,
                'api_url' => GREEN_API_URL,
                'instance_status' => $status['stateInstance'] ?? 'unknown',
                'whatsapp_status' => isset($status['stateInstance']) && $status['stateInstance'] == 'authorized' ? 'Connected' : 'Check connection'
            ]
        ]);
        break;
        
    // (Debug actions from original file are omitted for brevity in this example, but would be here)

    default:
        // פעולה לא ידועה
        echo json_encode([
            'success' => false,
            'error' => 'Invalid action',
            'provider' => 'Green API'
        ]);
        break;
}
?>