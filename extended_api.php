<?php
// extended_api.php - API מורחב לניהול לקוחות ומנויים
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/config.php';

class ExtendedAPI {
    private $baseId;
    private $apiKey;
    private $baseUrl = 'https://api.airtable.com/v0/';
    
    public function __construct() {
        $this->baseId = AIRTABLE_BASE_ID;
        $this->apiKey = AIRTABLE_API_KEY;
    }
    
    private function makeRequest($endpoint, $method = 'GET', $data = null) {
        $url = $this->baseUrl . $this->baseId . '/' . $endpoint;
        $headers = [ 'Authorization: Bearer ' . $this->apiKey, 'Content-Type: application/json' ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [ CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method ]);
        if ($data) { curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data)); }
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($httpCode >= 400) ? ['error' => 'API Error: ' . $httpCode, 'details' => json_decode($response, true)] : json_decode($response, true);
    }

    private function makeConcurrentRequests(array $requests) {
        $multiHandle = curl_multi_init();
        $handles = [];
        foreach ($requests as $key => $req) {
            // **THE FIX IS HERE:** The table/recordId part of the path is NOT URL-encoded.
            // http_build_query handles the encoding for the parameters only.
            $url = $this->baseUrl . $this->baseId . '/' . $req['table'] . '?' . http_build_query($req['params']);
            
            $headers = ['Authorization: Bearer ' . $this->apiKey, 'Content-Type: application/json'];
            $ch = curl_init($url);
            curl_setopt_array($ch, [ CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true ]);
            $handles[$key] = $ch;
            curl_multi_add_handle($multiHandle, $ch);
        }
        $running = null;
        do { curl_multi_exec($multiHandle, $running); curl_multi_select($multiHandle); } while ($running > 0);
        $results = [];
        foreach ($handles as $key => $ch) {
            $results[$key] = json_decode(curl_multi_getcontent($ch), true);
            curl_multi_remove_handle($multiHandle, $ch);
        }
        curl_multi_close($multiHandle);
        return $results;
    }
    
    public function getClientDetails($clientId) {
        $requests = [
            'client'        => ['table' => 'Clients/' . $clientId, 'params' => []],
            'bookings'      => ['table' => 'Bookings', 'params' => ['filterByFormula' => "SEARCH('$clientId', ARRAYJOIN({Client Link}))", 'sort[0][field]' => 'Date', 'sort[0][direction]' => 'desc']],
            'subscriptions' => ['table' => 'ClientSubscriptions', 'params' => ['filterByFormula' => "SEARCH('$clientId', ARRAYJOIN({Client}))"]],
            'tasks'         => ['table' => 'Tasks', 'params' => ['filterByFormula' => "SEARCH('$clientId', ARRAYJOIN({Related Client}))"]]
        ];
        $results = $this->makeConcurrentRequests($requests);
        
        if (isset($results['client']['error']) || !isset($results['client']['id'])) {
             return ['success' => false, 'error' => "Could not find client with ID {$clientId}. It may have been deleted."];
        }

        $stats = $this->calculateClientStats($results['bookings']['records'] ?? []);
        return ['success' => true, 'client' => $results['client'], 'bookings' => $results['bookings']['records'] ?? [], 'subscriptions' => $results['subscriptions']['records'] ?? [], 'tasks' => $results['tasks']['records'] ?? [], 'stats' => $stats];
    }
    
    public function getSubscriptionDetails($subscriptionId) {
        $subscription = $this->makeRequest('ClientSubscriptions/' . $subscriptionId);
        if (isset($subscription['error'])) return ['success' => false, 'error' => "Could not find subscription."];
        
        $clientId = $subscription['fields']['Client'][0] ?? null;
        if (!$clientId) {
            return ['success' => true, 'subscription' => $subscription, 'client' => null, 'usage_history' => []];
        }
        $requests = [
            'client'   => ['table' => 'Clients/' . $clientId, 'params' => []],
            'bookings' => ['table' => 'Bookings', 'params' => ['filterByFormula' => "AND(SEARCH('$clientId', ARRAYJOIN({Client Link})), {Status}='בוצע')"]]
        ];
        $results = $this->makeConcurrentRequests($requests);
        $usageHistory = $this->calculateSubscriptionUsage($subscription, $results['bookings']['records'] ?? []);
        return ['success' => true, 'subscription' => $subscription, 'client' => $results['client'] ?? null, 'usage_history' => $usageHistory];
    }

    private function calculateSubscriptionUsage($subscription, $clientBookings) {
        $usage = [];
        $startDate = $subscription['fields']['Start Date'] ?? '1970-01-01';
        foreach ($clientBookings as $booking) {
            if (($booking['fields']['Date'] ?? '') >= $startDate && strpos($booking['fields']['Notes'] ?? '', 'ניקוב') !== false) {
                $usage[] = ['date' => $booking['fields']['Date'], 'cars' => $booking['fields']['Number of Cars'] ?? 1, 'notes' => $booking['fields']['Notes']];
            }
        }
        return $usage;
    }

    private function calculateClientStats($bookings) {
        $stats = ['total_bookings' => count($bookings), 'completed_bookings' => 0, 'total_revenue' => 0, 'average_cars' => 0, 'last_visit' => null, 'next_visit' => null, 'monthly_breakdown' => []];
        $carCounts = []; $today = date('Y-m-d');
        foreach ($bookings as $booking) {
            $status = $booking['fields']['Status'] ?? ''; $date = $booking['fields']['Date'] ?? '';
            if ($status === 'בוצע') { $stats['completed_bookings']++; $stats['total_revenue'] += floatval($booking['fields']['Price'] ?? 0); }
            $carCounts[] = intval($booking['fields']['Number of Cars'] ?? 1);
            if ($date) {
                if ($date < $today && $status === 'בוצע' && !$stats['last_visit']) { $stats['last_visit'] = $date; }
                if ($date >= $today && $status === 'מאושר' && !$stats['next_visit']) { $stats['next_visit'] = $date; }
                $month = substr($date, 0, 7);
                if (!isset($stats['monthly_breakdown'][$month])) { $stats['monthly_breakdown'][$month] = ['bookings' => 0, 'revenue' => 0]; }
                $stats['monthly_breakdown'][$month]['bookings']++;
                if ($status === 'בוצע') { $stats['monthly_breakdown'][$month]['revenue'] += floatval($booking['fields']['Price'] ?? 0); }
            }
        }
        if (count($carCounts) > 0) { $stats['average_cars'] = round(array_sum($carCounts) / count($carCounts), 1); }
        return $stats;
    }
    
    public function updateClient($clientId, $fields) {
        $result = $this->makeRequest('Clients/' . $clientId, 'PATCH', ['fields' => $fields]);
        return isset($result['id']) ? ['success' => true, 'record' => $result] : ['success' => false, 'error' => $result['error'] ?? 'Update failed'];
    }
    
    public function updateSubscription($subscriptionId, $fields) {
        if (isset($fields['Total Washes']) || isset($fields['Used Washes'])) {
            $current = $this->makeRequest('ClientSubscriptions/' . $subscriptionId);
            $total = $fields['Total Washes'] ?? $current['fields']['Total Washes'] ?? 0;
            $used = $fields['Used Washes'] ?? $current['fields']['Used Washes'] ?? 0;
            $fields['Remaining Washes'] = strval(intval($total) - intval($used));
        }
        $result = $this->makeRequest('ClientSubscriptions/' . $subscriptionId, 'PATCH', ['fields' => $fields]);
        return isset($result['id']) ? ['success' => true, 'record' => $result] : ['success' => false, 'error' => $result['error'] ?? 'Update failed'];
    }
}

// Main request handler
$api = new ExtendedAPI();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
try {
    switch ($action) {
        case 'client_details':
            $clientId = $_GET['id'] ?? ''; if (!$clientId) throw new Exception('Client ID required');
            echo json_encode($api->getClientDetails($clientId)); break;
        case 'subscription_details':
            $subId = $_GET['id'] ?? ''; if (!$subId) throw new Exception('Subscription ID required');
            echo json_encode($api->getSubscriptionDetails($subId)); break;
        case 'update_client':
            if ($method !== 'POST') throw new Exception('POST method required');
            $data = json_decode(file_get_contents('php://input'), true);
            $clientId = $data['id'] ?? ''; $fields = $data['fields'] ?? []; if (!$clientId) throw new Exception('Client ID required');
            echo json_encode($api->updateClient($clientId, $fields)); break;
        case 'update_subscription':
            if ($method !== 'POST') throw new Exception('POST method required');
            $data = json_decode(file_get_contents('php://input'), true);
            $subId = $data['id'] ?? ''; $fields = $data['fields'] ?? []; if (!$subId) throw new Exception('Subscription ID required');
            echo json_encode($api->updateSubscription($subId, $fields)); break;
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>