<?php
/**
 * File: api/subscriptions/update_subscriber.php
 * Purpose: Allows administrators to verify, approve, or reject subscriber monthly roster payments or manually activate/expire accounts.
 *          Extends plans appropriately (30 days from next billing date on early approvals) and sends HTML invoice emails.
 * Input Params: JSON body (customer_id, status ['Approved', 'Rejected', 'Inactive'])
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - The subscription and customer records must exist.
 * Output: JSON response indicating success or specific validation error.
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

// === SECTION: INPUT HANDLING ===
$inputData = json_decode(file_get_contents("php://input"), true);

if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

$email = isset($inputData['email']) ? trim($inputData['email']) : null;
$status = isset($inputData['status']) ? trim($inputData['status']) : null; // 'Approved' or 'Rejected'

// === SECTION: INPUT VALIDATION ===
if (empty($email) || empty($status)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. email and status are required fields."
    ]);
    exit();
}

$email_err = validate_email_active($email);
if ($email_err !== true) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => $email_err
    ]);
    exit();
}

if ($status !== 'Approved' && $status !== 'Rejected' && $status !== 'Inactive') {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid status value. Must be 'Approved', 'Rejected', or 'Inactive'."
    ]);
    exit();
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Require admin privileges
    require_auth('Admin');
    verify_csrf_request();

    // Retrieve the subscription information
    $subQuery = "SELECT s.subscription_id, s.user_id, s.plan_status, u.email, u.username AS full_name 
                 FROM Subscription s
                 JOIN User u ON s.user_id = u.user_id
                 WHERE u.email = :email LIMIT 1";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $subStmt->execute();
    $subscriber = $subStmt->fetch();

    if (!$subscriber) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Subscriber record not found for the provided email."
        ]);
        exit();
    }

    $customer_id = 0;
    $user_id = (int)$subscriber['user_id'];

    // Double-Approval Prevention (Idempotency check)
    if ($subscriber['plan_status'] === 'Active' && $status === 'Approved') {
        log_system_event($conn, 'Redundant Subscription Approval Ignored', "Idempotency filter triggered: Subscription for User ID {$user_id} is already Active. Approval request ignored.");
        echo json_encode([
            "status" => "success",
            "message" => "Subscription is already Active. Action ignored to prevent duplicate processing."
        ]);
        exit();
    }

    // Start transaction
    $conn->beginTransaction();

    if ($status === 'Approved') {
        // Fetch current subscription dates
        $dateFetchQuery = "SELECT next_billing_date, plan_status FROM Subscription WHERE user_id = :user_id LIMIT 1";
        $dateFetchStmt = $conn->prepare($dateFetchQuery);
        $dateFetchStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $dateFetchStmt->execute();
        $subDates = $dateFetchStmt->fetch();

        $today = date('Y-m-d');
        if ($subDates && $subDates['plan_status'] === 'Active' && !empty($subDates['next_billing_date']) && $subDates['next_billing_date'] >= $today) {
            // Early renewal: extend from the current next billing date
            $nextBillingDate = date('Y-m-d', strtotime($subDates['next_billing_date'] . ' + 30 days'));
            $lastBillingDate = $subDates['next_billing_date'];
        } else {
            // Standard/first-time/expired renewal: extend from today
            $nextBillingDate = date('Y-m-d', strtotime('+30 days'));
            $lastBillingDate = $today;
        }

        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Active', 
                          last_billing_date = :last_billing, 
                          next_billing_date = :next_billing 
                      WHERE user_id = :user_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':last_billing', $lastBillingDate, PDO::PARAM_STR);
        $stmtSub->bindValue(':next_billing', $nextBillingDate, PDO::PARAM_STR);
        $stmtSub->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $stmtSub->execute();

        // Update Payment status to 'Paid'
        $updatePay = "UPDATE Payment p
                      JOIN Invoice i ON p.invoice_id = i.invoice_id
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET p.payment_status = 'Paid'
                      WHERE s.user_id = :user_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $stmtPay->execute();

        // Update Invoice status to 'Paid'
        $updateInv = "UPDATE Invoice i
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET i.invoice_status = 'Paid' 
                      WHERE s.user_id = :user_id 
                        AND i.invoice_type = 'Monthly Roster'
                        AND i.invoice_status = 'Pending'";
        $stmtInv = $conn->prepare($updateInv);
        $stmtInv->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $stmtInv->execute();

        log_system_event($conn, 'Subscription Approved', "Subscription for User ID {$user_id} approved as Active by Admin. Next billing date: {$nextBillingDate}.");

    } elseif ($status === 'Inactive') {
        // Deactivate subscription
        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Expired' 
                      WHERE user_id = :user_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $stmtSub->execute();

        log_system_event($conn, 'Subscription Downgraded', "Subscription for User ID {$user_id} manually set to Expired by Admin.");

    } else {
        // Reject subscription request or renewal
        // Fetch current subscription plan status and next billing date
        $checkQuery = "SELECT plan_status, next_billing_date FROM Subscription WHERE user_id = :user_id LIMIT 1";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $checkStmt->execute();
        $subInfo = $checkStmt->fetch();

        $today = date('Y-m-d');
        if ($subInfo && $subInfo['plan_status'] === 'Active' && !empty($subInfo['next_billing_date']) && $subInfo['next_billing_date'] >= $today) {
            // Early renewal rejection: Keep current subscription Active because they're already paid up for their current cycle.
            // We just reject the payment upload, allowing them to try again.
            log_system_event($conn, 'Renewal Payment Rejected', "Subscription renewal payment for User ID {$user_id} rejected by Admin. Subscription remains Active for current cycle.");
        } else {
            // Rejection of new signup or expired renewal: set subscription status to 'Expired'
            $updateSub = "UPDATE Subscription 
                          SET plan_status = 'Expired' 
                          WHERE user_id = :user_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':user_id', $user_id, PDO::PARAM_INT);
            $stmtSub->execute();
            
            log_system_event($conn, 'Subscription Registration Rejected', "Subscription signup request for User ID {$user_id} rejected by Admin. plan_status set to Expired.");
        }

        // Update Payment status to 'Rejected'
        $updatePay = "UPDATE Payment p
                      JOIN Invoice i ON p.invoice_id = i.invoice_id
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET p.payment_status = 'Rejected'
                      WHERE s.user_id = :user_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $stmtPay->execute();
    }

    $conn->commit();

    // Send confirmation or rejection email if email exists
    $clientEmail = $subscriber['email'];
    $fullName = $subscriber['full_name'];
    if ($clientEmail && filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';

        // Fetch latest invoice details for this subscription renewal
        $invQuery = "SELECT invoice_id, total_amount, issued_at 
                     FROM Invoice 
                     WHERE subscription_id = :subscription_id 
                       AND invoice_type = 'Monthly Roster' 
                     ORDER BY issued_at DESC LIMIT 1";
        $invStmt = $conn->prepare($invQuery);
        $invStmt->bindValue(':subscription_id', $subscriber['subscription_id'], PDO::PARAM_INT);
        $invStmt->execute();
        $latestInv = $invStmt->fetch();
        
        $invoice_id = $latestInv ? (int)$latestInv['invoice_id'] : 0;
        $amount = $latestInv ? (float)$latestInv['total_amount'] : 1500.00;
        $invDate = $latestInv ? substr($latestInv['issued_at'], 0, 10) : date('Y-m-d');

        $invoiceData = [
            'invoice_no' => 'INV-' . $invoice_id,
            'date' => $invDate,
            'client_name' => $fullName,
            'client_email' => $clientEmail,
            'item_name' => 'VIP Unlimited Plan',
            'item_subtext' => 'Monthly VIP subscription roster payment.',
            'item_price' => $amount,
            'subtotal' => $amount,
            'total_due' => $amount
        ];

        if ($status === 'Approved') {
            $subject = "Subscription Approved - VIP Unlimited Plan";
            $invoiceData['title'] = 'Official Invoice';
            $invoiceData['status_bg'] = '#f4fbf7';
            $invoiceData['status_border'] = '#27ae60';
            $invoiceData['status_color'] = '#27ae60';
            $invoiceData['status_label'] = 'PAID / ACTIVE';
            $invoiceData['status_detail'] = 'Your registration payment has been successfully approved! Your VIP Unlimited Plan is now ACTIVE.';
        } elseif ($status === 'Rejected') {
            $subject = "Subscription Registration Rejected";
            $invoiceData['title'] = 'Rejection Notice';
            $invoiceData['status_bg'] = '#fdf2f2';
            $invoiceData['status_border'] = '#c0392b';
            $invoiceData['status_color'] = '#c0392b';
            $invoiceData['status_label'] = 'PAYMENT REJECTED';
            $invoiceData['status_detail'] = 'We regret to inform you that your subscription registration payment proof was rejected. Please review your GCash receipt details and resubmit registration.';
        } else {
            // Inactive / manual downgrade
            $subject = "Subscription Service Status Update";
            $invoiceData['title'] = 'Subscription Downgraded';
            $invoiceData['status_bg'] = '#fef9e7';
            $invoiceData['status_border'] = '#e67e22';
            $invoiceData['status_color'] = '#d35400';
            $invoiceData['status_label'] = 'INACTIVE / EXPIRED';
            $invoiceData['status_detail'] = 'Your VIP Unlimited Plan subscription has been updated to INACTIVE. Your priority scheduling access and detailing wash session benefits are now expired.';
        }

        $htmlContent = Mailer::formatInvoice($invoiceData);
        Mailer::send($clientEmail, $subject, $htmlContent);
    }

    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => [
            "message" => "Subscriber account and payment status updated successfully to " . $status . "!",
            "email" => $email,
            "status" => $status
        ]
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Failed to update subscriber status: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while updating the status."
    ]);
}
?>
