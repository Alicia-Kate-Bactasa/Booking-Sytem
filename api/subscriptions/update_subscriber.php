<?php
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

    // Retrieve the subscription and customer information
    $subQuery = "SELECT s.subscription_id, s.customer_id, s.plan_status, u.email, c.full_name 
                 FROM Subscription s
                 JOIN Customer c ON s.customer_id = c.customer_id
                 JOIN User u ON c.customer_id = u.customer_id
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

    $customer_id = (int)$subscriber['customer_id'];

    // Double-Approval Prevention (Idempotency check)
    if ($subscriber['plan_status'] === 'Active' && $status === 'Approved') {
        log_system_event($conn, 'Redundant Subscription Approval Ignored', "Idempotency filter triggered: Subscription for Customer ID {$customer_id} is already Active. Approval request ignored.");
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
        $dateFetchQuery = "SELECT next_billing_date, plan_status FROM Subscription WHERE customer_id = :customer_id LIMIT 1";
        $dateFetchStmt = $conn->prepare($dateFetchQuery);
        $dateFetchStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
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
                      WHERE customer_id = :customer_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':last_billing', $lastBillingDate, PDO::PARAM_STR);
        $stmtSub->bindValue(':next_billing', $nextBillingDate, PDO::PARAM_STR);
        $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtSub->execute();

        // Update Payment status to 'Paid'
        $updatePay = "UPDATE Payment p
                      JOIN Invoice i ON p.invoice_id = i.invoice_id
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET p.payment_status = 'Paid'
                      WHERE s.customer_id = :customer_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtPay->execute();

        // Update Invoice status to 'Paid'
        $updateInv = "UPDATE Invoice i
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET i.invoice_status = 'Paid' 
                      WHERE s.customer_id = :customer_id 
                        AND i.invoice_type = 'Monthly Roster'
                        AND i.invoice_status = 'Pending'";
        $stmtInv = $conn->prepare($updateInv);
        $stmtInv->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtInv->execute();

        // Also update Customer type to Subscriber
        $updateCustType = "UPDATE Customer SET customer_type = 'Subscriber' WHERE customer_id = :customer_id";
        $stmtCustType = $conn->prepare($updateCustType);
        $stmtCustType->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtCustType->execute();

        log_system_event($conn, 'Subscription Approved', "Subscription for Customer ID {$customer_id} approved as Active by Admin. Next billing date: {$nextBillingDate}.");

    } elseif ($status === 'Inactive') {
        // Deactivate subscription
        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Expired' 
                      WHERE customer_id = :customer_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtSub->execute();

        // Revert Customer type to Regular
        $updateCust = "UPDATE Customer SET customer_type = 'Regular' WHERE customer_id = :customer_id";
        $stmtCust = $conn->prepare($updateCust);
        $stmtCust->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtCust->execute();

        log_system_event($conn, 'Subscription Downgraded', "Subscription for Customer ID {$customer_id} manually set to Expired by Admin.");

    } else {
        // Reject subscription request or renewal
        // Fetch current subscription plan status and next billing date
        $checkQuery = "SELECT plan_status, next_billing_date FROM Subscription WHERE customer_id = :customer_id LIMIT 1";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $checkStmt->execute();
        $subInfo = $checkStmt->fetch();

        $today = date('Y-m-d');
        if ($subInfo && $subInfo['plan_status'] === 'Active' && !empty($subInfo['next_billing_date']) && $subInfo['next_billing_date'] >= $today) {
            // Early renewal rejection: Keep current subscription Active because they're already paid up for their current cycle.
            // We just reject the payment upload, allowing them to try again.
            log_system_event($conn, 'Renewal Payment Rejected', "Subscription renewal payment for Customer ID {$customer_id} rejected by Admin. Subscription remains Active for current cycle.");
        } else {
            // Rejection of new signup or expired renewal: set subscription status to 'Expired'
            $updateSub = "UPDATE Subscription 
                          SET plan_status = 'Expired' 
                          WHERE customer_id = :customer_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $stmtSub->execute();
            
            // Revert Customer type to Regular
            $updateCust = "UPDATE Customer SET customer_type = 'Regular' WHERE customer_id = :customer_id";
            $stmtCust = $conn->prepare($updateCust);
            $stmtCust->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $stmtCust->execute();

            log_system_event($conn, 'Subscription Registration Rejected', "Subscription signup request for Customer ID {$customer_id} rejected by Admin. plan_status set to Expired.");
        }

        // Update Payment status to 'Rejected'
        $updatePay = "UPDATE Payment p
                      JOIN Invoice i ON p.invoice_id = i.invoice_id
                      JOIN Subscription s ON i.subscription_id = s.subscription_id
                      SET p.payment_status = 'Rejected'
                      WHERE s.customer_id = :customer_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtPay->execute();
    }

    $conn->commit();

    // Send confirmation or rejection email if email exists
    $clientEmail = $subscriber['email'];
    $fullName = $subscriber['full_name'];
    if ($clientEmail && filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';

        if ($status === 'Approved') {
            $subject = "Subscription Approved - VIP Unlimited Plan";
            $htmlContent = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='color: #27ae60; margin-top: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;'>Subscription Approved</h2>
                    </div>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    <p>Your subscription registration has been approved! Your <strong>VIP Unlimited Plan</strong> is now Active.</p>
                    <p style='background-color: #f4fbf7; border-left: 3px solid #27ae60; padding: 12px; color: #27ae60;'>
                        You can now log in to your dashboard to schedule your covered detailing sessions and enjoy priority access.
                    </p>
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
                    <p style='font-size: 11px; color: #888; text-align: center;'>If you have any questions, reach us at support@montageautostudio.com</p>
                </div>
            ";
        } elseif ($status === 'Rejected') {
            $subject = "Subscription Registration Rejected";
            $htmlContent = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='color: #c0392b; margin-top: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;'>Registration Rejected</h2>
                    </div>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    <p>We regret to inform you that your subscription registration payment proof has been rejected by our team.</p>
                    <p style='background-color: #fdf2f2; border-left: 3px solid #c0392b; padding: 12px; color: #c0392b;'>
                        Your registration attempt has been archived. Please review your GCash payment receipt details and resubmit registration with a valid proof of payment.
                    </p>
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
                    <p style='font-size: 11px; color: #888; text-align: center;'>If you have any questions, reach us at support@montageautostudio.com</p>
                </div>
            ";
        } else {
            // Inactive / manual downgrade
            $subject = "Subscription Service Status Update";
            $htmlContent = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='color: #e67e22; margin-top: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;'>Subscription Inactive</h2>
                    </div>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    <p>Your subscription VIP Unlimited Plan has been manually updated to <strong>Inactive</strong> (Expired).</p>
                    <p style='background-color: #fef9e7; border-left: 3px solid #e67e22; padding: 12px; color: #d35400;'>
                        Your active VIP privileges have been revoked. If you believe this is in error, please contact our support team or renew your subscription from the booking page.
                    </p>
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
                    <p style='font-size: 11px; color: #888; text-align: center;'>If you have any questions, reach us at support@montageautostudio.com</p>
                </div>
            ";
        }

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
