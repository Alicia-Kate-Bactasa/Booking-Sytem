<?php
/**
 * File: api/subscriptions/get_subscribers.php
 * Purpose: Fetches the listing of active subscribers for the administrative directory dashboard.
 * Input Params: None (requires Admin authentication)
 * Logical Rules:
 *   - Prepends '../' to relative database image paths so they load correctly relative to the admin dashboard.
 * Output: JSON response returning subscriber accounts data.
 */

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
                     u.username AS name,
                     u.email,
                     p.proof_of_payment AS img
              FROM Subscription s
              JOIN User u ON s.user_id = u.user_id
              LEFT JOIN (
                  SELECT i1.subscription_id, p1.proof_of_payment
                  FROM Invoice i1
                  JOIN Payment p1 ON i1.invoice_id = p1.invoice_id
                  WHERE i1.invoice_type = 'Monthly Roster'
                    AND i1.invoice_id = (
                        SELECT MAX(invoice_id) 
                        FROM Invoice 
                        WHERE subscription_id = i1.subscription_id 
                          AND invoice_type = 'Monthly Roster'
                    )
              ) p ON s.subscription_id = p.subscription_id
              WHERE s.plan_status != 'Payment Pending'
              ORDER BY s.subscription_id DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $subscribers = $stmt->fetchAll();

    // Map database values to UI schema compatibility
    $formattedSubscribers = array_map(function($sub) {
        // UI expects Status: "Verified" or "Rejected / Overdue" or "Pending"
        $status = 'Verified';
        if ($sub['status'] === 'Expired') {
            $status = 'Expired';
        } elseif ($sub['status'] === 'Inactive') {
            $status = 'Inactive';
        }
        
        $img = $sub['img'];
        if ($img && !preg_match('/^(http|data:|..\/)/', $img)) {
            $img = '../' . $img;
        }

        return [
            "id" => "sub-" . $sub['subscription_id'],
            "subscriber_id" => (int)$sub['subscription_id'],
            "name" => $sub['name'] ? $sub['name'] : 'Subscriber User',
            "email" => $sub['email'],
            "next_billing_date" => $sub['next_billing_date'] ? $sub['next_billing_date'] : '—',
            "status" => $status,
            "proof_image" => $img ? $img : ''
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
