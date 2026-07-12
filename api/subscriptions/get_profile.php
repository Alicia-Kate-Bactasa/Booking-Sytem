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

// === SECTION: DATABASE QUERY & EXECUTION ===
try {
    // Require Subscriber authentication
    require_auth(['Subscriber', 'Admin']);

    $subscriber_id = null;
    $whereClause = "";
    if ($_SESSION['role'] === 'Subscriber') {
        $subscriber_id = (int)$_SESSION['user_id'];
        $whereClause = "u.user_id = :subscriber_id";
    } elseif ($_SESSION['role'] === 'Admin' && isset($_GET['subscriber_id'])) {
        $subscriber_id = (int)$_GET['subscriber_id'];
        $whereClause = "s.subscription_id = :subscriber_id";
    }

    if (!$subscriber_id) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Subscriber ID is required."
        ]);
        exit();
    }

    $query = "SELECT s.subscription_id AS subscriber_id, s.customer_id, u.email, s.plan_tier, s.plan_status, s.next_billing_date, c.full_name 
              FROM Subscription s
              JOIN Customer c ON s.customer_id = c.customer_id
              JOIN User u ON c.user_id = u.user_id
              WHERE {$whereClause} 
              LIMIT 1";
              
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':subscriber_id', $subscriber_id, PDO::PARAM_INT);
    $stmt->execute();
    $profile = $stmt->fetch();
    
    if (!$profile) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Subscriber profile not found in the database."
        ]);
        exit();
    }

    $customer_id = (int)$profile['customer_id'];
    
    // Check pending renewal payment
    $pendingQuery = "SELECT p.payment_id FROM Payment p
                     JOIN Invoice i ON p.invoice_id = i.invoice_id
                     WHERE i.customer_id = :customer_id
                       AND i.invoice_type = 'Monthly Roster'
                       AND p.payment_status = 'Pending Approval' LIMIT 1";
    $pendingStmt = $conn->prepare($pendingQuery);
    $pendingStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $pendingStmt->execute();
    $hasPending = (bool)$pendingStmt->fetch();

    // Check recent paid renewal payment (within last 28 days)
    $recentQuery = "SELECT p.payment_id FROM Payment p
                    JOIN Invoice i ON p.invoice_id = i.invoice_id
                    WHERE i.customer_id = :customer_id
                      AND i.invoice_type = 'Monthly Roster'
                      AND p.payment_status = 'Paid'
                      AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 28 DAY) LIMIT 1";
    $recentStmt = $conn->prepare($recentQuery);
    $recentStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $recentStmt->execute();
    $hasRecentPaid = (bool)$recentStmt->fetch();

    $renewal_accounted_for = $hasPending || $hasRecentPaid;
    $renewal_status = $hasPending ? 'Pending Approval' : ($hasRecentPaid ? 'Paid' : null);

    // === SECTION: SUCCESS RESPONSE ===
    echo json_encode([
        "status" => "success",
        "data" => [
            "subscriber_id" => (int)$profile['subscriber_id'],
            "customer_id" => (int)$profile['customer_id'],
            "email" => $profile['email'],
            "full_name" => $profile['full_name'],
            "plan_tier" => $profile['plan_tier'],
            "plan_status" => $profile['plan_status'],
            "next_billing_date" => $profile['next_billing_date'],
            "renewal_accounted_for" => $renewal_accounted_for,
            "renewal_status" => $renewal_status
        ]
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to fetch subscriber profile: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching profile data."
    ]);
}
?>
