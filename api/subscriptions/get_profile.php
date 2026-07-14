<?php
// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

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
        if (isset($_SESSION['customer_id'])) {
            $subscriber_id = (int)$_SESSION['customer_id'];
            $whereClause = "s.customer_id = :subscriber_id";
        } else {
            $subscriber_id = (int)$_SESSION['user_id'];
            $whereClause = "s.subscription_id = :subscriber_id";
        }
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

    $query = "SELECT s.subscription_id AS subscriber_id, s.customer_id, u.email, s.plan_tier, s.plan_status, s.last_billing_date, s.next_billing_date, c.full_name 
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

    $subscription_id = (int)$profile['subscriber_id'];
    
    // Check if a pending invoice exists of type 'Monthly Roster' and status 'Pending'
    $pendingInvoiceQuery = "SELECT invoice_id FROM Invoice 
                            WHERE subscription_id = :subscription_id 
                              AND invoice_type = 'Monthly Roster'
                              AND invoice_status = 'Pending'
                            LIMIT 1";
    $pendingInvoiceStmt = $conn->prepare($pendingInvoiceQuery);
    $pendingInvoiceStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
    $pendingInvoiceStmt->execute();
    $hasPendingInvoice = (bool)$pendingInvoiceStmt->fetch();

    // Check if user is locked (current date is before or on next_billing_date)
    $today = date('Y-m-d');
    $is_locked = false;
    if ($profile['plan_status'] === 'Active' && !empty($profile['next_billing_date'])) {
        if ($profile['next_billing_date'] >= $today) {
            $is_locked = true;
        }
    }

    $renewal_status = null;
    if ($hasPendingInvoice) {
        $renewal_status = 'Payment Awaiting Approval';
    } elseif ($is_locked) {
        $renewal_status = 'Locked';
    } else {
        $renewal_status = 'Active';
    }

    $renewal_accounted_for = $hasPendingInvoice || $is_locked;

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
