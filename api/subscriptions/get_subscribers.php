<?php
// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET requests are accepted."
    ]);
    exit();
}

try {
    // Require admin privilege
    require_auth('Admin');

    $query = "SELECT s.subscription_id, 
                     s.plan_tier, 
                     s.plan_status AS status, 
                     s.next_billing_date,
                     c.full_name AS name,
                     u.email,
                     p.proof_of_payment AS img
              FROM Subscription s
              JOIN Customer c ON s.customer_id = c.customer_id
              JOIN User u ON c.user_id = u.user_id
              LEFT JOIN Invoice i ON (c.customer_id = i.customer_id AND i.invoice_type = 'Monthly Roster')
              LEFT JOIN Payment p ON i.invoice_id = p.invoice_id
              ORDER BY s.subscription_id DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $subscribers = $stmt->fetchAll();

    // Map database values to UI schema compatibility
    $formattedSubscribers = array_map(function($sub) {
        // UI expects Status: "Verified" or "Rejected / Overdue" or "Pending"
        $status = 'Verified';
        if ($sub['status'] === 'Payment Pending' || $sub['status'] === 'Inactive') {
            $status = 'Rejected / Overdue';
        }
        
        return [
            "id" => "sub-" . $sub['subscription_id'],
            "subscriber_id" => (int)$sub['subscription_id'],
            "name" => $sub['name'],
            "email" => $sub['email'],
            "next_billing_date" => $sub['next_billing_date'] ? $sub['next_billing_date'] : '—',
            "status" => $status,
            "proof_image" => $sub['img'] ? $sub['img'] : ''
        ];
    }, $subscribers);

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $formattedSubscribers
    ]);

} catch (Exception $e) {
    error_log("Failed to fetch subscribers: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching subscriber list: " . $e->getMessage()
    ]);
}
?>
