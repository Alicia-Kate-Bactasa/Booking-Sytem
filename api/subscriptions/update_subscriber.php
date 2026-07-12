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
                 JOIN User u ON c.user_id = u.user_id
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
                      SET p.payment_status = 'Paid'
                      WHERE i.customer_id = :customer_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtPay->execute();

        // Update Invoice status to 'Paid'
        $updateInv = "UPDATE Invoice 
                      SET invoice_status = 'Paid' 
                      WHERE customer_id = :customer_id 
                        AND invoice_type = 'Monthly Roster'
                        AND invoice_status = 'Pending'";
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
        // Reject subscription request
        // Update Subscription plan_status = 'Expired' (archived)
        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Expired' 
                      WHERE customer_id = :customer_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtSub->execute();

        // Update Payment status to 'Rejected'
        $updatePay = "UPDATE Payment p
                      JOIN Invoice i ON p.invoice_id = i.invoice_id
                      SET p.payment_status = 'Rejected'
                      WHERE i.customer_id = :customer_id
                        AND i.invoice_type = 'Monthly Roster'
                        AND p.payment_status = 'Pending Approval'";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $stmtPay->execute();

        log_system_event($conn, 'Subscription Rejected', "Subscription request for Customer ID {$customer_id} rejected by Admin. plan_status archived as Expired.");
    }

    $conn->commit();

    // Send confirmation or rejection email if email exists
    $clientEmail = $subscriber['email'];
    $fullName = $subscriber['full_name'];
    if ($clientEmail && filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
        if ($status === 'Approved') {
            $subject = "Subscription Approved - VIP Unlimited Plan";
            $message = "Hello " . $fullName . ",\n\n";
            $message .= "Your subscription registration has been approved! Your VIP Unlimited Plan is now Active.\n\n";
            $message .= "You can now log in to your dashboard to schedule your detailing sessions.\n\n";
            $message .= "Best regards,\nMontage Auto Studio Team";
        } elseif ($status === 'Rejected') {
            $subject = "Subscription Registration Rejected";
            $message = "Hello " . $fullName . ",\n\n";
            $message .= "We regret to inform you that your subscription registration payment proof has been rejected by our team.\n\n";
            $message .= "Your registration attempt has been archived. Please review your GCash payment receipt details and resubmit registration with a valid proof of payment.\n\n";
            $message .= "Best regards,\nMontage Auto Studio Team";
        }
        $headers = "From: no-reply@montageautostudio.com\r\n" .
                   "Reply-To: support@montageautostudio.com\r\n" .
                   "X-Mailer: PHP/" . phpversion();

        @mail($clientEmail, $subject, $message, $headers);
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
