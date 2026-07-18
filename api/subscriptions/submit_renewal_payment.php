<?php
/**
 * File: api/subscriptions/submit_renewal_payment.php
 * Purpose: Handles upload of GCash payment receipts for subscriber plan renewals from the dashboard.
 *          Processes image file upload, checks duplicate pending payments, enforces temporal window locks, 
 *          reuses existing outstanding pending invoices, and logs system audit details.
 * Input Params: POST file (proof_of_payment)
 * Validation rules:
 *   - User session must belong to a Subscriber.
 *   - Duplicate pending payment check (cannot submit payments if one is awaiting approval).
 *   - Temporal Lock: CURRENT_DATE > last_billing_date (must enter current cycle to pay next one).
 *   - Uploaded GCash proof must be valid image format (JPG, PNG, GIF, WEBP) <= 8MB.
 * Output: JSON response indicating success or specific validation error.
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

try {
    // Require Subscriber authentication
    require_auth('Subscriber');
    verify_csrf_request();
    
    $user_id = (int)$_SESSION['user_id'];

    // 1. Guard against duplicate proof submissions / spam:
    // Check if there is already a Pending Monthly Roster invoice for this customer that has a payment awaiting approval
    $pendingInvoiceQuery = "SELECT i.invoice_id FROM Invoice i
                            JOIN Subscription s ON i.subscription_id = s.subscription_id
                            JOIN Payment p ON i.invoice_id = p.invoice_id
                            WHERE s.user_id = :user_id 
                              AND i.invoice_type = 'Monthly Roster'
                              AND i.invoice_status = 'Pending'
                              AND p.payment_status = 'Pending Approval'
                            LIMIT 1";
    $pendingInvoiceStmt = $conn->prepare($pendingInvoiceQuery);
    $pendingInvoiceStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
    $pendingInvoiceStmt->execute();
    if ($pendingInvoiceStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Submission Blocked: You already have a subscription payment awaiting admin approval."
        ]);
        exit();
    }

    // 2. Fetch Subscription details
    $subQuery = "SELECT s.subscription_id, s.last_billing_date, s.plan_status, c.full_name, u.email
                 FROM Subscription s
                 JOIN User u ON s.user_id = u.user_id
                 LEFT JOIN Customer c ON u.email = c.email
                 WHERE s.user_id = :user_id LIMIT 1";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
    $subStmt->execute();
    $sub = $subStmt->fetch();

    // 3. Guard against early prepayment (Temporal Eligibility Lock)
    // Ensure CURRENT_DATE > last_billing_date
    $today = date('Y-m-d');
    if ($sub && !empty($sub['last_billing_date'])) {
        if ($today <= $sub['last_billing_date']) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Temporal Eligibility Violation: You have already prepaid for the upcoming cycle."
            ]);
            exit();
        }
    }

    // 3. Verify that proof of payment file was uploaded
    if (!isset($_FILES['proof_of_payment']) || $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Proof of payment screenshot is required. File upload failed or was not provided."
        ]);
        exit();
    }

    $file = $_FILES['proof_of_payment'];
    $fileSize = $file['size'];
    $fileTmpPath = $file['tmp_name'];
    $fileName = $file['name'];

    // Validate File Size (Limit to 8MB)
    $maxFileSize = 8 * 1024 * 1024;
    if ($fileSize > $maxFileSize) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "File size exceeds the allowable limit of 8MB."
        ]);
        exit();
    }

    // Validate File Extension
    $fileNameParts = explode('.', $fileName);
    $fileExtension = strtolower(end($fileNameParts));
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!in_array($fileExtension, $allowedExtensions, true)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid file extension. Only JPG, JPEG, PNG, GIF, and WEBP images are allowed."
        ]);
        exit();
    }

    // Verify actual Image MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $fileTmpPath);
    finfo_close($finfo);

    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($mimeType, $allowedMimeTypes, true)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "File format validation failed. The uploaded file is not a valid image type."
        ]);
        exit();
    }

    // Create uploads directory if it does not exist
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Generate unique name for the file
    $newFileName = md5(uniqid(microtime(), true)) . '.' . $fileExtension;
    $destinationPath = $uploadDir . $newFileName;
    $databaseSavedPath = 'uploads/' . $newFileName;

    // Move uploaded file to final destination
    if (!move_uploaded_file($fileTmpPath, $destinationPath)) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "An error occurred while saving the uploaded screenshot on the server."
        ]);
        exit();
    }

    // Start transaction
    $conn->beginTransaction();

    $subscription_id = $sub ? (int)$sub['subscription_id'] : null;

    // Determine if we reuse an existing outstanding Pending invoice
    $pendingInvQuery = "SELECT invoice_id FROM Invoice 
                        WHERE subscription_id = :subscription_id 
                          AND invoice_type = 'Monthly Roster'
                          AND invoice_status = 'Pending'
                        ORDER BY issued_at ASC
                        LIMIT 1";
    $pendingInvStmt = $conn->prepare($pendingInvQuery);
    $pendingInvStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
    $pendingInvStmt->execute();
    $pendingInvoice = $pendingInvStmt->fetch();

    if ($pendingInvoice) {
        $invoice_id = (int)$pendingInvoice['invoice_id'];
    } else {
        // Create a new Invoice of type 'Monthly Roster'
        $invoiceQuery = "INSERT INTO Invoice (subscription_id, total_amount, invoice_type, invoice_status) 
                         VALUES (:subscription_id, 1500.00, 'Monthly Roster', 'Pending')";
        $invoiceStmt = $conn->prepare($invoiceQuery);
        $invoiceStmt->bindValue(':subscription_id', $subscription_id, $subscription_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $invoiceStmt->execute();
        $invoice_id = (int)$conn->lastInsertId();
    }

    // Create Payment of status 'Pending Approval' linked to the invoice
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, 1500.00, 'GCash', :proof_of_payment, 'Pending Approval')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // Set plan_status to 'Payment Pending' only if they are not already Active
    if ($sub && $sub['plan_status'] !== 'Active') {
        $subQuery = "UPDATE Subscription SET plan_status = 'Payment Pending' WHERE user_id = :user_id";
        $subStmt = $conn->prepare($subQuery);
        $subStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $subStmt->execute();
    }

    $conn->commit();

    // Send subscription renewal pending confirmation email
    if ($sub && !empty($sub['email']) && filter_var($sub['email'], FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        $subject = "Subscription Renewal Pending Verification - Montage Auto Studio";

        $invoiceData = [
            'title' => 'Pro-forma Invoice',
            'invoice_no' => 'INV-' . $invoice_id,
            'date' => date('Y-m-d'),
            'client_name' => $sub['full_name'],
            'client_email' => $sub['email'],
            'item_name' => 'VIP Unlimited Plan (Renewal)',
            'item_subtext' => 'Monthly subscription plan with priority scheduling.',
            'item_price' => 1500.00,
            'subtotal' => 1500.00,
            'total_due' => 1500.00,
            'status_bg' => '#fef9e7',
            'status_border' => '#f39c12',
            'status_color' => '#d35400',
            'status_label' => 'PENDING VERIFICATION',
            'status_detail' => 'We have received your GCash renewal payment screenshot. Please allow 24-48 hours for administrative verification.'
        ];

        $htmlContent = Mailer::formatInvoice($invoiceData);
        Mailer::send($sub['email'], $subject, $htmlContent);
    }

    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "message" => "Monthly subscription payment submitted successfully! Awaiting verification.",
        "data" => [
            "invoice_id" => $invoice_id,
            "proof_path" => $databaseSavedPath
        ]
    ]);

} catch (Exception $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    if (isset($destinationPath) && file_exists($destinationPath)) {
        @unlink($destinationPath);
    }
    error_log("Renewal payment submission failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while submitting your renewal request."
    ]);
}
?>
