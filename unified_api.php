<?php
date_default_timezone_set('Asia/Jerusalem');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/api_error_log.txt');

require_once __DIR__ . '/config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

const ALLOWED_TABLES = [ 'StaffMembers', 'Clients', 'Bookings', 'ClientSubscriptions' ];

function sendJsonResponse($data, $statusCode = 200) { http_response_code($statusCode); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); exit(); }
function logError($message) { file_put_contents(__DIR__ . '/api_error_log.txt', date('[Y-m-d H:i:s]') . ' ' . $message . PHP_EOL, FILE_APPEND); }
function sanitizeInput($input) { return is_array($input) ? array_map('sanitizeInput', $input) : htmlspecialchars(trim($input ?? ''), ENT_QUOTES, 'UTF-8'); }

function airtableRequest($url, $method = 'GET', $data = null) {
    $ch = curl_init();
    $headers = ['Authorization: Bearer ' . AIRTABLE_API_KEY, 'Content-Type: application/json'];
    curl_setopt_array($ch, [ CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 30 ]);
    if ($data !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data)); }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($curlError) { logError('cURL Error: ' . $curlError); throw new Exception('Network error'); }
    $decoded = json_decode($response, true);
    if ($httpCode >= 400) { throw new Exception($decoded['error']['message'] ?? 'Airtable API error: ' . $response); }
    return $decoded;
}

if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $action = sanitizeInput($_GET['action'] ?? '');
    
    $rawInput = file_get_contents('php://input');
    $input = [];
    if (!empty($rawInput)) {
        $decoded = json_decode($rawInput, true);
        if (json_last_error() === JSON_ERROR_NONE) { $input = $decoded; }
    }
    
    // אם אין action ב-GET, נסה מה-POST body
    if (empty($action)) {
        $action = sanitizeInput($input['action'] ?? '');
    }
    
    if (empty($action)) {
        sendJsonResponse(['error' => 'Action is required.'], 400);
    }

    try {
        switch ($action) {
            
            case 'staff_login':
                $phone = sanitizeInput($input['phone'] ?? '');
                $pin = sanitizeInput($input['pin'] ?? '');
                if (empty($phone) || empty($pin)) {
                    sendJsonResponse(['success' => false, 'error' => 'Phone and PIN are required.'], 400);
                }
    
                // בניית שאילתה מאובטחת לאימות מול Airtable
                $formula = "AND({Phone Number} = '{$phone}', {PIN Code} = '{$pin}', {Status} = 'פעיל')";
                $url = AIRTABLE_API_URL . urlencode('StaffMembers') . '?filterByFormula=' . urlencode($formula);
                $response = airtableRequest($url);

                if (!empty($response['records'])) {
                    // --- כאן מתחיל הקוד החדש ---
                    $staffRecord = $response['records'][0];
                    $fields = $staffRecord['fields'];

                    // 1. בניית המערך עם נתוני המשתמש עבור העוגיה
                    $userData = [
                        'name' => $fields['Full Name'] ?? 'איש צוות',
                        'type' => 'staff',
                        'role' => $fields['Role'] ?? 'צוות'
                    ];

                    // 2. המרת המערך ל-JSON
                    $jsonUserData = json_encode($userData, JSON_UNESCAPED_UNICODE);

                    // 3. יצירת העוגיה שתזוהה על ידי ההדר
                    setcookie('carwasher_user', $jsonUserData, time() + (86400 * 30), "/");
                    // --- סוף הקוד החדש ---

                    // שלח תגובת הצלחה בחזרה ל-JavaScript
                    sendJsonResponse(['success' => true, 'staff' => $staffRecord]);

                } else {
                    // אם האימות נכשל, שלח תגובת שגיאה
                    sendJsonResponse(['success' => false, 'error' => 'פרטי התחברות שגויים או משתמש לא פעיל.'], 401);
                }
                break;

            case 'get_records':
                // תיקון: קבל table גם מ-GET וגם מ-POST
                $table = sanitizeInput($_GET['table'] ?? $input['table'] ?? '');
                if (empty($table) || !in_array($table, ALLOWED_TABLES)) {
                    sendJsonResponse(['error' => 'Invalid or missing table.'], 400);
                }
                
                if ($table === 'Bookings' && isset($_GET['date'])) {
                    $dateStr = sanitizeInput($_GET['date']);
                    $targetDate = DateTime::createFromFormat('Y-m-d', $dateStr);
                    if($targetDate === false) { sendJsonResponse(['error' => 'Invalid date format.'], 400); }

                    $finalRecords = [];

                    // רק הזמנות רגילות לתאריך הספציפי
                    $formulaSingle = "{Date} = '{$dateStr}'";
                    $urlSingle = AIRTABLE_API_URL . urlencode('Bookings') . '?filterByFormula=' . urlencode($formulaSingle);
                    $singleResponse = airtableRequest($urlSingle);
                    if (!empty($singleResponse['records'])) {
                        foreach($singleResponse['records'] as $record) {
                            // רק אם אין תדירות חוזרת
                            if(empty($record['fields']['Frequency'])) {
                                $finalRecords[] = $record;
                            }
                        }
                    }

                    // הזמנות חוזרות
                    $formulaRecurring = "OR({Frequency} = 'weekly', {Frequency} = 'biweekly')";
                    $urlRecurring = AIRTABLE_API_URL . urlencode('Bookings') . '?filterByFormula=' . urlencode($formulaRecurring);
                    $recurringResponse = airtableRequest($urlRecurring);

                    if (!empty($recurringResponse['records'])) {
                        foreach ($recurringResponse['records'] as $record) {
                            try {
                                $fields = $record['fields'];
                                if (empty($fields['Date'])) continue;

                                $startDate = DateTime::createFromFormat('Y-m-d', $fields['Date']);
                                if ($startDate === false) continue;

                                if ($targetDate < $startDate) continue;
                                
                                $endDate = null;
                                if (!empty($fields['EndDate'])) {
                                    $endDate = DateTime::createFromFormat('Y-m-d', $fields['EndDate']);
                                    if ($endDate === false) $endDate = null;
                                }

                                if ($endDate && $targetDate > $endDate) continue;

                                $exceptions = !empty($fields['ExceptionDates']) ? explode(',', str_replace(' ', '', $fields['ExceptionDates'])) : [];
                                if (in_array($dateStr, $exceptions)) continue;
                                
                                $diff = $startDate->diff($targetDate)->days;
                                $increment = ($fields['Frequency'] === 'weekly') ? 7 : 14;
                                
                                if ($diff % $increment === 0) {
                                    $finalRecords[] = $record;
                                }
                            } catch (Exception $e) {
                                logError("Skipping recurring record: " . $e->getMessage());
                                continue;
                            }
                        }
                    }
                    sendJsonResponse(['records' => $finalRecords]);

                } else { 
                    $pageSize = intval(sanitizeInput($_GET['pageSize'] ?? $input['pageSize'] ?? '100'));
                    $pageSize = min(100, max(1, $pageSize));
                    $offset = sanitizeInput($_GET['offset'] ?? $input['offset'] ?? null);
                    
                    $url = AIRTABLE_API_URL . urlencode($table) . '?pageSize=' . $pageSize;
                    if ($offset) {
                        $url .= '&offset=' . urlencode($offset);
                    }
                    
                    $response = airtableRequest($url);
                    
                    sendJsonResponse([
                        'records' => $response['records'] ?? [],
                        'offset' => $response['offset'] ?? null 
                    ]);
                }
                break;
            
            case 'get_active_subscription_for_client':
                $clientId = sanitizeInput($_GET['clientId'] ?? $input['clientId'] ?? '');
                if (empty($clientId)) sendJsonResponse(['error' => 'Client ID is required.'], 400);
                $formula = "AND(SEARCH('$clientId', ARRAYJOIN({Client})), {Status} = 'פעיל', VALUE({Remaining Washes}) > 0)";
                $url = AIRTABLE_API_URL . urlencode('ClientSubscriptions') . '?filterByFormula=' . urlencode($formula);
                $url .= '&sort[0][field]=Start%20Date&sort[0][direction]=desc';
                $response = airtableRequest($url);
                if (!empty($response['records'])) {
                    $subscription = $response['records'][0];
                    // סנכרון שמות שדות
                    if (isset($subscription['fields']['Wash Value'])) {
                        $subscription['fields']['Price Per Wash'] = $subscription['fields']['Wash Value'];
                    }
                    sendJsonResponse(['success' => true, 'subscription' => $subscription]);
                } else {
                    sendJsonResponse(['success' => true, 'subscription' => null]);
                }
                break;

            case 'update_record':
                $table = sanitizeInput($input['table'] ?? '');
                if (empty($table) || !in_array($table, ALLOWED_TABLES)) sendJsonResponse(['error' => 'Invalid table for update.'], 400);
                $id = sanitizeInput($input['id'] ?? '');
                if (empty($id)) sendJsonResponse(['error' => 'Record ID required.'], 400);
                $fields = $input['fields'] ?? null;
                if (empty($fields)) sendJsonResponse(['error' => 'No fields provided.'], 400);
                
                // אם מעדכנים כרטיסיה, עדכן אוטומטית את Remaining Washes
                if ($table === 'ClientSubscriptions') {
                    if (isset($fields['Used Washes']) && !isset($fields['Remaining Washes'])) {
                        // קבל את הרשומה הנוכחית
                        $currentUrl = AIRTABLE_API_URL . urlencode($table) . '/' . $id;
                        $currentRecord = airtableRequest($currentUrl);
                        $totalWashes = intval($currentRecord['fields']['Total Washes'] ?? 0);
                        $usedWashes = intval($fields['Used Washes']);
                        $fields['Remaining Washes'] = strval($totalWashes - $usedWashes);
                    }
                }
                
                $url = AIRTABLE_API_URL . urlencode($table) . '/' . $id;
                $response = airtableRequest($url, 'PATCH', ['fields' => $fields]);
                sendJsonResponse(['success' => true, 'record' => $response]);
                break;
                
            case 'create_record':
                $table = sanitizeInput($input['table'] ?? '');
                if (empty($table) || !in_array($table, ALLOWED_TABLES)) sendJsonResponse(['error' => 'Invalid table.'], 400);
                $fields = $input['fields'] ?? null;
                if (empty($fields)) sendJsonResponse(['error' => 'No fields provided.'], 400);
                
                // אם יוצרים כרטיסיה חדשה, הגדר את Remaining Washes
                if ($table === 'ClientSubscriptions' && isset($fields['Total Washes']) && !isset($fields['Remaining Washes'])) {
                    $fields['Remaining Washes'] = $fields['Total Washes'];
                }
                
                $url = AIRTABLE_API_URL . urlencode($table);
                $response = airtableRequest($url, 'POST', ['fields' => $fields]);
                sendJsonResponse(['success' => true, 'record' => $response]);
                break;

            default:
                sendJsonResponse(['error' => 'Unknown action: ' . sanitizeInput($action)], 400);
                break;
        }
    } catch (Exception $e) {
        logError($e->getMessage());
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
?>