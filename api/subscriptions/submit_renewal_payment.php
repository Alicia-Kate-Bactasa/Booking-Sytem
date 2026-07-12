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
    verify_csrf_request();
    
    $customer_id = (int)$_SESSION['customer_id'];

    // 1. Guard against duplicate proof submissions / spam:
    // Check if there is already a Pending Monthly Roster invoice for this customer
    $pendingInvoiceQuery = "SELECT invoice_id FROM Invoice 
                            WHERE customer_id = :customer_id 
                              AND invoice_type = 'Monthly Roster'
                              AND invoice_status = 'Pending'
                            LIMIT 1";
    $pendingInvoiceStmt = $conn->prepare($pendingInvoiceQuery);
    $pendingInvoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $pendingInvoiceStmt->execute();
    if ($pendingInvoiceStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Submission Blocked: You already have a subscription payment awaiting admin approval."
        ]);
        exit();
    }

    // 2. Guard against double payment within the active billing cycle:
    // Check if the subscription is already prepaid (last_billing_date is in the future)
    $subQuery = "SELECT last_billing_date, plan_status FROM Subscription WHERE customer_id = :customer_id LIMIT 1";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $subStmt->execute();
    $sub = $subStmt->fetch();

    $today = date('Y-m-d');
    if ($sub && $sub['plan_status'] === 'Active' && !empty($sub['next_billing_date'])) {
        if ($sub['next_billing_date'] >= $today) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Double Payment Blocked: Renewal is not yet available."
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

    // Create a new Invoice of type 'Monthly Roster'
    $invoiceQuery = "INSERT INTO Invoice (customer_id, total_amount, invoice_type, invoice_status) 
                     VALUES (:customer_id, 1500.00, 'Monthly Roster', 'Pending')";
    $invoiceStmt = $conn->prepare($invoiceQuery);
    $invoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $invoiceStmt->execute();
    $invoice_id = (int)$conn->lastInsertId();

    // Create Payment of status 'Pending Approval' linked to the invoice
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, 1500.00, 'GCash', :proof_of_payment, 'Pending Approval')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // Set plan_status to 'Payment Pending' only if they are not already Active
    if ($sub && $sub['plan_status'] !== 'Active') {
        $subQuery = "UPDATE Subscription SET plan_status = 'Payment Pending' WHERE customer_id = :customer_id";
        $subStmt = $conn->prepare($subQuery);
        $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $subStmt->execute();
    }

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
