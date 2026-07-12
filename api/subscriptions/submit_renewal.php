<?php
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
    
    $customer_id = (int)$_SESSION['customer_id'];

    // 1. Guard against duplicate proof submissions:
    // Check if there is already a payment proof submitted that is pending admin approval
    $pendingPaymentQuery = "SELECT p.payment_id 
                            FROM Payment p
                            JOIN Invoice i ON p.invoice_id = i.invoice_id
                            WHERE i.customer_id = :customer_id
                              AND i.invoice_type = 'Monthly Roster'
                              AND p.payment_status = 'Pending Approval'
                            LIMIT 1";
    $pendingPaymentStmt = $conn->prepare($pendingPaymentQuery);
    $pendingPaymentStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $pendingPaymentStmt->execute();
    if ($pendingPaymentStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Submission Blocked: You already have a payment proof pending admin verification. Please wait for approval."
        ]);
        exit();
    }

    // 2. Guard against double payment within the active billing cycle:
    // Check if they already paid their invoice in the last 28 days
    $recentPaidQuery = "SELECT p.payment_id, p.payment_date 
                        FROM Payment p
                        JOIN Invoice i ON p.invoice_id = i.invoice_id
                        WHERE i.customer_id = :customer_id
                          AND i.invoice_type = 'Monthly Roster'
                          AND p.payment_status = 'Paid'
                          AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 28 DAY)
                        LIMIT 1";
    $recentPaidStmt = $conn->prepare($recentPaidQuery);
    $recentPaidStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $recentPaidStmt->execute();
    if ($recentPaidStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Double Payment Blocked: Your subscription is currently active and paid. One payment per month only."
        ]);
        exit();
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
    $uploadDir = __DIR__ . '/../uploads/';
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

    // 4. Determine if we reuse an existing outstanding Pending invoice (e.g. from June)
    // or create a new invoice
    $pendingInvQuery = "SELECT invoice_id FROM Invoice 
                        WHERE customer_id = :customer_id 
                          AND invoice_type = 'Monthly Roster'
                          AND invoice_status = 'Pending'
                        ORDER BY issued_at ASC
                        LIMIT 1";
    $pendingInvStmt = $conn->prepare($pendingInvQuery);
    $pendingInvStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $pendingInvStmt->execute();
    $pendingInvoice = $pendingInvStmt->fetch();

    if ($pendingInvoice) {
        $invoice_id = (int)$pendingInvoice['invoice_id'];
    } else {
        // Create a new Invoice of type 'Monthly Roster'
        $invoiceQuery = "INSERT INTO Invoice (customer_id, total_amount, invoice_type, invoice_status) 
                         VALUES (:customer_id, 1500.00, 'Monthly Roster', 'Pending')";
        $invoiceStmt = $conn->prepare($invoiceQuery);
        $invoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $invoiceStmt->execute();
        $invoice_id = (int)$conn->lastInsertId();
    }

    // 5. Create Payment of status 'Pending Approval' linked to the invoice
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, 1500.00, 'GCash', :proof_of_payment, 'Pending Approval')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // 6. Set plan_status to 'Payment Pending' (awaiting approval)
    $subQuery = "UPDATE Subscription SET plan_status = 'Payment Pending' WHERE customer_id = :customer_id";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $subStmt->execute();

    $conn->commit();

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
        unlink($destinationPath);
    }
    error_log("Renewal submission failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while submitting your renewal request: " . $e->getMessage()
    ]);
}
?>
