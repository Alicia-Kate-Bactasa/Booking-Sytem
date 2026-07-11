<?php
// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once 'config.php';

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

if ($status !== 'Approved' && $status !== 'Rejected') {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid status value. Must be 'Approved' or 'Rejected'."
    ]);
    exit();
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Require admin privileges
    require_auth('Admin');
    verify_csrf_request();

    // Retrieve the subscription and customer information
    $subQuery = "SELECT s.subscription_id, s.customer_id, s.plan_status 
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
        // Update Subscription plan_status = 'Active' and billing dates
        $today = date('Y-m-d');
        $nextBillingDate = date('Y-m-d', strtotime('+30 days'));

        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Active', 
                          last_billing_date = :last_billing, 
                          next_billing_date = :next_billing 
                      WHERE customer_id = :customer_id";
        $stmtSub = $conn->prepare($updateSub);
        $stmtSub->bindValue(':last_billing', $today, PDO::PARAM_STR);
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

    } else {
        // Reject subscription request
        // Update Subscription plan_status = 'Payment Pending' (awaiting retry)
        $updateSub = "UPDATE Subscription 
                      SET plan_status = 'Payment Pending' 
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

        log_system_event($conn, 'Subscription Rejected', "Subscription request for Customer ID {$customer_id} rejected by Admin. plan_status reverted to Payment Pending.");
    }

    $conn->commit();

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
