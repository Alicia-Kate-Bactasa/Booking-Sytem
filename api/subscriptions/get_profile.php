<?php
/**
 * File: api/subscriptions/get_profile.php
 * Purpose: Retrieves active subscriber details (tier, status, dates) and resolves their renewal state.
 *          Gathers actual completed detailing booking counts and visit history from the database to replace placeholder info.
 * Input Params: None (reads session customer_id)
 * State-Machine logic returned:
 *   - Awaiting Approval: A GCash payment screenshot has been uploaded and is pending administrative review.
 *   - Temporal Lock: CURRENT_DATE <= last_billing_date (upcoming billing cycle is already prepaid).
 *   - Payment Rejected: Administrative rejection occurred, re-enables payments.
 *   - Active & Eligible to Pay: Current date > last_billing_date, payment is open.
 * Output: JSON response returning subscriber variables and resolved state machine tags.
 */

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
        $subscriber_id = (int)$_SESSION['user_id'];
        $whereClause = "s.user_id = :subscriber_id";
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

    $query = "SELECT s.subscription_id AS subscriber_id, s.user_id, u.email, s.plan_tier, s.plan_status, s.last_billing_date, s.next_billing_date, s.created_at, c.full_name, c.customer_id 
              FROM Subscription s
              JOIN User u ON s.user_id = u.user_id
              LEFT JOIN Customer c ON u.email = c.email
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
    $user_id = (int)$profile['user_id'];
    
    // Fetch last completed booking date
    $lastVisitQuery = "SELECT MAX(scheduled_date) AS last_visit FROM Booking WHERE user_id = :user_id AND booking_status = 'Completed'";
    $lastVisitStmt = $conn->prepare($lastVisitQuery);
    $lastVisitStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
    $lastVisitStmt->execute();
    $lastVisitRow = $lastVisitStmt->fetch();
    $last_visit = $lastVisitRow['last_visit'] ? date("F j, Y", strtotime($lastVisitRow['last_visit'])) : 'None yet';

    // Fetch completed sessions count
    $completedCountQuery = "SELECT COUNT(*) AS completed_count FROM Booking WHERE user_id = :user_id AND booking_status = 'Completed'";
    $completedCountStmt = $conn->prepare($completedCountQuery);
    $completedCountStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
    $completedCountStmt->execute();
    $completedCountRow = $completedCountStmt->fetch();
    $completed_sessions_count = (int)$completedCountRow['completed_count'];

    $today = date('Y-m-d');

    // Check if a pending approval payment exists for the most recent Monthly Roster invoice
    $pendingApprovalQuery = "SELECT i.invoice_id FROM Invoice i
                             JOIN Payment p ON i.invoice_id = p.invoice_id
                             WHERE i.subscription_id = :subscription_id 
                               AND i.invoice_type = 'Monthly Roster'
                               AND i.invoice_status = 'Pending'
                               AND p.payment_status = 'Pending Approval'
                             LIMIT 1";
    $pendingApprovalStmt = $conn->prepare($pendingApprovalQuery);
    $pendingApprovalStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
    $pendingApprovalStmt->execute();
    $hasPendingApproval = (bool)$pendingApprovalStmt->fetch();

    // Check if a rejected payment exists for the most recent Monthly Roster invoice
    $rejectedInvoiceQuery = "SELECT i.invoice_id FROM Invoice i
                             JOIN Payment p ON i.invoice_id = p.invoice_id
                             WHERE i.subscription_id = :subscription_id 
                               AND i.invoice_type = 'Monthly Roster'
                               AND i.invoice_status = 'Pending'
                               AND p.payment_status = 'Rejected'
                             LIMIT 1";
    $rejectedInvoiceStmt = $conn->prepare($rejectedInvoiceQuery);
    $rejectedInvoiceStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
    $rejectedInvoiceStmt->execute();
    $hasRejectedInvoice = (bool)$rejectedInvoiceStmt->fetch();

    // Determine renewal status according to the exact state machine rules
    if ($hasPendingApproval) {
        $renewal_status = 'Awaiting Approval';
    } elseif (!empty($profile['last_billing_date']) && $today <= $profile['last_billing_date']) {
        $renewal_status = 'Temporal Lock';
    } elseif ($hasRejectedInvoice) {
        $renewal_status = 'Payment Rejected';
    } else {
        $renewal_status = 'Active & Eligible to Pay';
    }

    $last_billing_date_plus_1 = '';
    if (!empty($profile['last_billing_date'])) {
        $last_billing_date_plus_1 = date("F j, Y", strtotime($profile['last_billing_date'] . ' + 1 day'));
    }

    // === SECTION: SUCCESS RESPONSE ===
    echo json_encode([
        "status" => "success",
        "data" => [
            "subscriber_id" => $subscription_id,
            "customer_id" => $customer_id,
            "email" => $profile['email'],
            "full_name" => $profile['full_name'],
            "plan_tier" => $profile['plan_tier'],
            "plan_status" => $profile['plan_status'],
            "created_at" => $profile['created_at'] ? date("F j, Y", strtotime($profile['created_at'])) : 'N/A',
            "last_billing_date" => $profile['last_billing_date'] ? date("F j, Y", strtotime($profile['last_billing_date'])) : 'None yet',
            "raw_last_billing_date" => $profile['last_billing_date'],
            "last_billing_date_plus_1" => $last_billing_date_plus_1,
            "next_billing_date" => $profile['next_billing_date'] ? date("F j, Y", strtotime($profile['next_billing_date'])) : 'Awaiting Payment Approval',
            "last_visit" => $last_visit,
            "completed_sessions_count" => $completed_sessions_count,
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
