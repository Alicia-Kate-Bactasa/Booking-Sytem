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

try {
    // Require admin privilege
    require_auth('Admin');
    verify_csrf_request();

    $inputData = json_decode(file_get_contents("php://input"), true);
    
    $invoice_id = isset($inputData['invoice_id']) ? (int)$inputData['invoice_id'] : null;
    $status = isset($inputData['status']) ? trim($inputData['status']) : null; // 'Paid' or 'Rejected'

    if (empty($invoice_id) || empty($status)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Incomplete request. invoice_id and status are required fields."
        ]);
        exit();
    }

    if ($status !== 'Paid' && $status !== 'Rejected') {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid status value. Must be 'Paid' or 'Rejected'."
        ]);
        exit();
    }

    // 1. Fetch current payment status for idempotency validation
    $payQuery = "SELECT payment_id, payment_status, amount FROM Payment WHERE invoice_id = :invoice_id LIMIT 1";
    $payStmt = $conn->prepare($payQuery);
    $payStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $payStmt->execute();
    $payment = $payStmt->fetch();

    if (!$payment) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "No payment record found associated with Invoice ID " . $invoice_id
        ]);
        exit();
    }

    // Double-Approval Prevention (Idempotence Guard check)
    if ($payment['payment_status'] === 'Paid' && $status === 'Paid') {
        // Log redundant request and return success directly (idempotent ignore)
        log_system_event($conn, 'Redundant Payment Approval Ignored', "Idempotency filter triggered: Invoice ID {$invoice_id} is already Paid. Second approval request ignored.");
        echo json_encode([
            "status" => "success",
            "message" => "Payment was already approved as Paid. Action ignored to prevent double-processing."
        ]);
        exit();
    }

    // Start transaction
    $conn->beginTransaction();

    // 2. Fetch Invoice details
    $invQuery = "SELECT customer_id, total_amount, invoice_type FROM Invoice WHERE invoice_id = :invoice_id LIMIT 1";
    $invStmt = $conn->prepare($invQuery);
    $invStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $invStmt->execute();
    $invoice = $invStmt->fetch();

    if (!$invoice) {
        $conn->rollBack();
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Invoice not found."
        ]);
        exit();
    }

    $customer_id = (int)$invoice['customer_id'];

    // Fetch customer email and name (from User if subscriber, or directly from Customer if regular guest)
    $emailQuery = "SELECT COALESCE(u.email, c.email) AS email, c.full_name 
                   FROM Customer c
                   LEFT JOIN User u ON c.user_id = u.user_id
                   WHERE c.customer_id = :customer_id LIMIT 1";
    $emailStmt = $conn->prepare($emailQuery);
    $emailStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $emailStmt->execute();
    $customerInfo = $emailStmt->fetch();

    $email = isset($customerInfo['email']) ? $customerInfo['email'] : null;
    $fullName = isset($customerInfo['full_name']) ? $customerInfo['full_name'] : 'Customer';

    if ($status === 'Paid') {
        // Update Payment status to Paid
        $updatePay = "UPDATE Payment SET payment_status = 'Paid' WHERE payment_id = :pay_id";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':pay_id', $payment['payment_id'], PDO::PARAM_INT);
        $stmtPay->execute();

        // Update Invoice status to Paid
        $updateInv = "UPDATE Invoice SET invoice_status = 'Paid' WHERE invoice_id = :invoice_id";
        $stmtInv = $conn->prepare($updateInv);
        $stmtInv->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
        $stmtInv->execute();

        // Also update associated Booking status to Confirmed for walk-ins (complying with updated ENUM value)
        $updateBook = "UPDATE Booking SET booking_status = 'Confirmed' WHERE invoice_id = :invoice_id AND booking_status = 'Pending Verification'";
        $stmtBook = $conn->prepare($updateBook);
        $stmtBook->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
        $stmtBook->execute();

        // If Subscription renewal payment, activate membership
        if ($invoice['invoice_type'] === 'Monthly Roster') {
            $today = date('Y-m-d');
            $nextBilling = date('Y-m-d', strtotime('+30 days'));

            // Set Customer to Subscriber
            $updateCust = "UPDATE Customer SET customer_type = 'Subscriber' WHERE customer_id = :customer_id";
            $stmtCust = $conn->prepare($updateCust);
            $stmtCust->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $stmtCust->execute();

            // Set Subscription to Active
            $updateSub = "UPDATE Subscription 
                          SET plan_status = 'Active', 
                              last_billing_date = :last_billing, 
                              next_billing_date = :next_billing 
                          WHERE customer_id = :customer_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':last_billing', $today, PDO::PARAM_STR);
            $stmtSub->bindValue(':next_billing', $nextBilling, PDO::PARAM_STR);
            $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $stmtSub->execute();
        }

        log_system_event($conn, 'Payment Approved', "Invoice ID {$invoice_id} (Customer ID {$customer_id}) marked as Paid. Amount: ₱{$payment['amount']}. Type: {$invoice['invoice_type']}.");
    } else {
        // Update Payment status to Rejected
        $updatePay = "UPDATE Payment SET payment_status = 'Rejected' WHERE payment_id = :pay_id";
        $stmtPay = $conn->prepare($updatePay);
        $stmtPay->bindValue(':pay_id', $payment['payment_id'], PDO::PARAM_INT);
        $stmtPay->execute();

        // Keep Invoice pending or Void? Keep as Pending for retry
        $updateInv = "UPDATE Invoice SET invoice_status = 'Pending' WHERE invoice_id = :invoice_id";
        $stmtInv = $conn->prepare($updateInv);
        $stmtInv->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
        $stmtInv->execute();

        if ($invoice['invoice_type'] === 'Monthly Roster') {
            // Set Subscription to Expired (archived)
            $updateSub = "UPDATE Subscription SET plan_status = 'Expired' WHERE customer_id = :customer_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $stmtSub->execute();
        }

        log_system_event($conn, 'Payment Rejected', "Invoice ID {$invoice_id} (Customer ID {$customer_id}) rejected. Status set to Rejected. Amount: ₱{$payment['amount']}. Type: {$invoice['invoice_type']}.");
    }

    $conn->commit();

    // Send confirmation or rejection email if email exists
    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';

        if ($status === 'Paid') {
            $subject = "Payment Approved - Invoice ID: INV-" . $invoice_id;
            $htmlContent = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='color: #111; margin-top: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;'>Payment Confirmed</h2>
                    </div>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    <p>Your payment of <strong>₱" . number_format($payment['amount'], 2) . "</strong> for Invoice <strong>INV-{$invoice_id}</strong> has been successfully approved!</p>
                    " . ($invoice['invoice_type'] === 'Monthly Roster'
                        ? "<p style='background-color: #f4fbf7; border-left: 3px solid #27ae60; padding: 12px; color: #27ae60;'>Your VIP Unlimited Plan subscription is now <strong>Active</strong>. Thank you for your support!</p>"
                        : "<p style='background-color: #f4fbf7; border-left: 3px solid #27ae60; padding: 12px; color: #27ae60;'>Your booking is now confirmed. We look forward to servicing your vehicle.</p>") . "
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
                    <p style='font-size: 11px; color: #888; text-align: center;'>If you have any questions, reach us at support@montageautostudio.com</p>
                </div>
            ";
        } else {
            $subject = "Registration Payment Rejected - Invoice ID: INV-" . $invoice_id;
            $htmlContent = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='color: #c0392b; margin-top: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;'>Payment Proof Rejected</h2>
                    </div>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    <p>Unfortunately, your payment of <strong>₱" . number_format($payment['amount'], 2) . "</strong> for Invoice <strong>INV-{$invoice_id}</strong> was rejected by our administrative team.</p>
                    " . ($invoice['invoice_type'] === 'Monthly Roster'
                        ? "<p style='background-color: #fdf2f2; border-left: 3px solid #c0392b; padding: 12px; color: #c0392b;'>Your subscription registration has been rejected. Please review your GCash payment receipt details and try registering again, or contact our support team.</p>"
                        : "<p style='background-color: #fdf2f2; border-left: 3px solid #c0392b; padding: 12px; color: #c0392b;'>Your booking confirmation was rejected due to an invalid payment proof. Please resubmit your booking with a valid payment screenshot.</p>") . "
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
                    <p style='font-size: 11px; color: #888; text-align: center;'>If you have any questions, reach us at support@montageautostudio.com</p>
                </div>
            ";
        }

        Mailer::send($email, $subject, $htmlContent);
    }

    echo json_encode([
        "status" => "success",
        "message" => "Payment successfully updated to " . $status . "!"
    ]);

} catch (Throwable $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("approve_payment.php transaction failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while approving the payment transaction: " . $e->getMessage()
    ]);
}
?>
