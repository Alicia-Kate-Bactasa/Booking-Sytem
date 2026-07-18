<?php
/**
 * File: api/payments/approve_payment.php
 * Purpose: Executed by administrators to approve or reject a submitted proof of payment (GCash screenshot).
 *          Approving a detailing booking sets the booking to 'Confirmed'. Approving a renewal payment
 *          sets the Subscription to 'Active', extends the next_billing_date by 30 days, and sends an invoice email
 *          highlighting their Booking Reference ID. Rejection sets statuses back and prompts the user to resubmit.
 * Input Params: JSON body (invoice_id, status ['Paid' or 'Rejected'])
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - The invoice and payment records must exist.
 *   - Subscription dates rollover appropriately on early renewal.
 * Output: JSON response indicating success or specific error.
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
    // 2. Fetch Invoice details and resolve client information dynamically
    $invQuery = "SELECT i.total_amount, 
                        i.invoice_type,
                        ser.service_name,
                        i.booking_id,
                        s.user_id AS subscription_user_id,
                        b.customer_id AS booking_customer_id,
                        CASE 
                            WHEN s.user_id IS NOT NULL THEN u1.email 
                            WHEN b.user_id IS NOT NULL THEN u2.email 
                            ELSE c.email 
                        END AS client_email,
                        CASE 
                            WHEN s.user_id IS NOT NULL THEN u1.username 
                            WHEN b.user_id IS NOT NULL THEN u2.username 
                            ELSE c.full_name 
                        END AS client_name
                 FROM Invoice i
                 LEFT JOIN Subscription s ON i.subscription_id = s.subscription_id
                 LEFT JOIN User u1 ON s.user_id = u1.user_id
                 LEFT JOIN Booking b ON i.booking_id = b.booking_id
                 LEFT JOIN User u2 ON b.user_id = u2.user_id
                 LEFT JOIN Customer c ON b.customer_id = c.customer_id
                 LEFT JOIN Service ser ON b.service_id = ser.service_id
                 WHERE i.invoice_id = :invoice_id LIMIT 1";
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

    $customer_id = $invoice['booking_customer_id'] ? (int)$invoice['booking_customer_id'] : 0;
    $subscription_user_id = $invoice['subscription_user_id'] ? (int)$invoice['subscription_user_id'] : 0;

    $email = $invoice['client_email'];
    $fullName = $invoice['client_name'] ? $invoice['client_name'] : 'Customer';

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

        // Also update associated Booking status to Confirmed for walk-ins
        if (!empty($invoice['booking_id'])) {
            $updateBook = "UPDATE Booking SET booking_status = 'Confirmed' WHERE booking_id = :booking_id AND booking_status = 'Pending Verification'";
            $stmtBook = $conn->prepare($updateBook);
            $stmtBook->bindValue(':booking_id', (int)$invoice['booking_id'], PDO::PARAM_INT);
            $stmtBook->execute();
        }

        // If Subscription renewal payment, activate membership
        if ($invoice['invoice_type'] === 'Monthly Roster') {
            // Fetch current subscription dates
            $dateFetchQuery = "SELECT next_billing_date, plan_status FROM Subscription WHERE user_id = :user_id LIMIT 1";
            $dateFetchStmt = $conn->prepare($dateFetchQuery);
            $dateFetchStmt->bindValue(':user_id', $subscription_user_id, PDO::PARAM_INT);
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

            // Set Customer to Subscriber
            if ($customer_id) {
                $updateCust = "UPDATE Customer SET customer_type = 'Subscriber' WHERE customer_id = :customer_id";
                $stmtCust = $conn->prepare($updateCust);
                $stmtCust->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
                $stmtCust->execute();
            }

            // Set Subscription to Active
            $updateSub = "UPDATE Subscription 
                          SET plan_status = 'Active', 
                              last_billing_date = :last_billing, 
                              next_billing_date = :next_billing 
                          WHERE user_id = :user_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':last_billing', $lastBillingDate, PDO::PARAM_STR);
            $stmtSub->bindValue(':next_billing', $nextBillingDate, PDO::PARAM_STR);
            $stmtSub->bindValue(':user_id', $subscription_user_id, PDO::PARAM_INT);
            $stmtSub->execute();
        }

        log_system_event($conn, 'Payment Approved', "Invoice ID {$invoice_id} marked as Paid. Amount: ₱{$payment['amount']}. Type: {$invoice['invoice_type']}.");
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

        // Cancel the associated booking to free the slot
        if ($invoice['invoice_type'] === 'Single Detailing' && !empty($invoice['booking_id'])) {
            $updateBook = "UPDATE Booking SET booking_status = 'Cancelled' WHERE booking_id = :booking_id";
            $stmtBook = $conn->prepare($updateBook);
            $stmtBook->bindValue(':booking_id', (int)$invoice['booking_id'], PDO::PARAM_INT);
            $stmtBook->execute();
        }

        if ($invoice['invoice_type'] === 'Monthly Roster') {
            // Set Subscription to Expired (archived)
            $updateSub = "UPDATE Subscription SET plan_status = 'Expired' WHERE user_id = :user_id";
            $stmtSub = $conn->prepare($updateSub);
            $stmtSub->bindValue(':user_id', $subscription_user_id, PDO::PARAM_INT);
            $stmtSub->execute();
        }

        log_system_event($conn, 'Payment Rejected', "Invoice ID {$invoice_id} rejected. Status set to Rejected. Amount: ₱{$payment['amount']}. Type: {$invoice['invoice_type']}.");
    }

    $conn->commit();

    // Send confirmation or rejection email if email exists
    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';

        $itemName = ($invoice['invoice_type'] === 'Monthly Roster') ? 'VIP Unlimited Plan' : ($invoice['service_name'] ?: 'Detailing Session');
        $itemSubtext = ($invoice['invoice_type'] === 'Monthly Roster') ? 'Monthly VIP membership access.' : 'Professional vehicle detailing service.';

        $invoiceData = [
            'invoice_no' => 'INV-' . $invoice_id,
            'date' => date('Y-m-d'),
            'client_name' => $fullName,
            'client_email' => $email,
            'item_name' => $itemName,
            'item_subtext' => $itemSubtext,
            'item_price' => (float)$payment['amount'],
            'subtotal' => (float)$payment['amount'],
            'total_due' => (float)$payment['amount'],
            'booking_id' => !empty($invoice['booking_id']) ? (int)$invoice['booking_id'] : null
        ];

        if ($status === 'Paid') {
            $subject = "Payment Approved - Invoice ID: INV-" . $invoice_id;
            $invoiceData['title'] = 'Official Invoice';
            $invoiceData['status_bg'] = '#f4fbf7';
            $invoiceData['status_border'] = '#27ae60';
            $invoiceData['status_color'] = '#27ae60';
            $invoiceData['status_label'] = 'PAID';
            $invoiceData['status_detail'] = ($invoice['invoice_type'] === 'Monthly Roster')
                ? 'Your payment has been successfully approved! Your VIP Unlimited Plan is now ACTIVE.'
                : 'Your booking payment has been successfully approved and confirmed. We look forward to servicing your vehicle!';
        } else {
            $subject = "Payment Proof Rejected - Invoice ID: INV-" . $invoice_id;
            $invoiceData['title'] = 'Rejection Notice';
            $invoiceData['status_bg'] = '#fdf2f2';
            $invoiceData['status_border'] = '#c0392b';
            $invoiceData['status_color'] = '#c0392b';
            $invoiceData['status_label'] = 'PAYMENT REJECTED';
            $invoiceData['status_detail'] = ($invoice['invoice_type'] === 'Monthly Roster')
                ? 'Unfortunately, your registration payment proof was rejected. Please review your GCash receipt details and resubmit registration.'
                : 'Unfortunately, your booking payment proof was rejected. Please resubmit your booking with a valid payment screenshot.';
        }

        $htmlContent = Mailer::formatInvoice($invoiceData);
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
