<?php
/**
 * File: api/subscriptions/cancel_subscription.php
 * Purpose: Allows subscribers to cancel their active VIP membership.
 *          Updates Subscription status to 'Inactive' and logs audit events.
 * Input Params: None (reads session customer_id)
 * Output: JSON response indicating success or cancellation error.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

try {
    // Require subscriber authentication
    require_auth('Subscriber');
    verify_csrf_request();

    $customer_id = $_SESSION['customer_id'];

    // Start database transaction
    $conn->beginTransaction();

    // Retrieve active subscription details
    $subQuery = "SELECT subscription_id, plan_status, next_billing_date 
                 FROM Subscription 
                 WHERE customer_id = :customer_id 
                   AND plan_status = 'Active' 
                 LIMIT 1";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $subStmt->execute();
    $subscription = $subStmt->fetch();

    if (!$subscription) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "No active subscription found to cancel or plan is already pending cancellation."
        ]);
        exit();
    }

    // Transition state to 'Cancellation Pending'
    $updateQuery = "UPDATE Subscription SET plan_status = 'Cancellation Pending' WHERE subscription_id = :sub_id";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':sub_id', $subscription['subscription_id'], PDO::PARAM_INT);
    $updateStmt->execute();

    // Log this transition in System_Logs
    log_system_event($conn, 'Subscription Cancellation Requested', "Customer ID {$customer_id} requested subscription cancellation. Plan status transitioned to Cancellation Pending. Expiry effective after next billing date: {$subscription['next_billing_date']}.");

    // Fetch user info for email notification
    $userQuery = "SELECT c.full_name, COALESCE(u.email, c.email) AS email 
                  FROM Customer c 
                  LEFT JOIN User u ON c.customer_id = u.customer_id 
                  WHERE c.customer_id = :customer_id LIMIT 1";
    $userStmt = $conn->prepare($userQuery);
    $userStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $userStmt->execute();
    $userInfo = $userStmt->fetch();

    if ($userInfo && !empty($userInfo['email']) && filter_var($userInfo['email'], FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        
        $email = $userInfo['email'];
        $name = $userInfo['full_name'] ?: 'VIP Member';
        $expiryDate = $subscription['next_billing_date'];
        
        $subject = "VIP Subscription Cancellation Confirmation";
        $html = Mailer::formatInvoice([
            'title' => 'Subscription Cancelled',
            'status_bg' => '#fdf2f2',
            'status_border' => '#c0392b',
            'status_color' => '#c0392b',
            'status_label' => 'CANCELLATION PENDING',
            'status_detail' => "Dear {$name}, your request to cancel your VIP Unlimited Wash subscription has been processed. Your benefits remain active until your next billing date: <strong>{$expiryDate}</strong>, after which your membership will expire.",
            'invoice_no' => 'SUB-' . $subscription['subscription_id'],
            'date' => date('Y-m-d'),
            'client_name' => $name,
            'client_email' => $email,
            'item_name' => 'VIP Unlimited Wash Plan',
            'item_subtext' => "Cancellation requested. Active until {$expiryDate}",
            'item_price' => 0.00,
            'subtotal' => 0.00,
            'total_due' => 0.00
        ]);
        
        try {
            Mailer::send($email, $subject, $html);
        } catch (Exception $mailEx) {
            error_log("Failed to send subscription cancellation email: " . $mailEx->getMessage());
        }
    }

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Subscription cancellation requested successfully. Your benefits remain active until " . $subscription['next_billing_date']
    ]);

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Cancellation failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while canceling the subscription. Please try again."
    ]);
}
?>
