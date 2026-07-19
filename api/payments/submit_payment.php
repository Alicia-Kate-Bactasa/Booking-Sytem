<?php
/**
 * File: api/payments/submit_payment.php
 * Purpose: Allows users to submit a payment proof (GCash receipt image) for an outstanding pending invoice.
 * Input Params: POST fields (invoice_id, amount, payment_method), FILE field (proof_of_payment)
 * Validation rules:
 *   - The invoice must exist and be 'Pending'.
 *   - Checks that file uploaded is valid image format (JPG, PNG, GIF, WEBP) <= 8MB.
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
// Note: $_POST is used here instead of php://input because this is a multipart/form-data
// request that includes a binary file upload (proof_of_payment screenshot).
$invoice_id = isset($_POST['invoice_id']) ? $_POST['invoice_id'] : null;
$amount = isset($_POST['amount']) ? $_POST['amount'] : null;
$payment_method = isset($_POST['payment_method']) ? trim($_POST['payment_method']) : 'GCash';

// === SECTION: INPUT VALIDATION ===
if (empty($invoice_id) || empty($amount)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. invoice_id and amount are required fields."
    ]);
    exit();
}

if (!filter_var($invoice_id, FILTER_VALIDATE_INT) || !is_numeric($amount)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid input format. invoice_id must be an integer and amount must be numeric."
    ]);
    exit();
}

// Verify that proof of payment file was uploaded
if (!isset($_FILES['proof_of_payment']) || $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_OK) {
    $uploadError = isset($_FILES['proof_of_payment']) ? $_FILES['proof_of_payment']['error'] : 'Missing file';
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Proof of payment screenshot is required. File upload failed or was not provided.",
        "upload_error_code" => $uploadError
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

// Verify actual Image MIME type to prevent malicious code injection
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
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to create uploads directory on the server."
        ]);
        exit();
    }
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

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);

    // Check if the referenced invoice exists and verify ownership via subscription or booking user_id
    $invoiceCheckQuery = "SELECT i.invoice_id, s.user_id AS sub_user_id, b.user_id AS book_user_id 
                          FROM Invoice i
                          LEFT JOIN Subscription s ON i.subscription_id = s.subscription_id
                          LEFT JOIN Booking b ON i.booking_id = b.booking_id
                          WHERE i.invoice_id = :invoice_id LIMIT 1";
    $invoiceCheckStmt = $conn->prepare($invoiceCheckQuery);
    $invoiceCheckStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $invoiceCheckStmt->execute();
    $invoice = $invoiceCheckStmt->fetch();
    
    if (!$invoice) {
        if (file_exists($destinationPath)) {
            unlink($destinationPath);
        }
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Referenced Invoice ID does not exist in the system database."
        ]);
        exit();
    }

    // If the authenticated user is a Subscriber, ensure they own this invoice (via Subscription or Booking user_id)
    if ($_SESSION['role'] === 'Subscriber') {
        $subUserId = $invoice['sub_user_id'] !== null ? (int)$invoice['sub_user_id'] : null;
        $bookUserId = $invoice['book_user_id'] !== null ? (int)$invoice['book_user_id'] : null;
        $sessionUserId = (int)$_SESSION['user_id'];
        
        if ($subUserId !== $sessionUserId && $bookUserId !== $sessionUserId) {
            if (file_exists($destinationPath)) {
                unlink($destinationPath);
            }
            http_response_code(403);
            echo json_encode([
                "status" => "error",
                "message" => "Forbidden. You are not authorized to submit payment for this invoice."
            ]);
            exit();
        }
    }

    $payment_status = 'Pending Approval';

    // Insert payment record
    $query = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
              VALUES (:invoice_id, :amount, :payment_method, :proof_of_payment, :payment_status)";
              
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $stmt->bindValue(':amount', $amount, PDO::PARAM_STR);
    $stmt->bindValue(':payment_method', $payment_method, PDO::PARAM_STR);
    $stmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $stmt->bindValue(':payment_status', $payment_status, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        // === SECTION: SUCCESS RESPONSE ===
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "data" => [
                "message" => "Payment transaction submitted successfully! Awaiting verification.",
                "payment_id" => (int)$conn->lastInsertId(),
                "proof_path" => $databaseSavedPath
            ]
        ]);
    } else {
        if (file_exists($destinationPath)) {
            unlink($destinationPath);
        }
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to write payment record to the database."
        ]);
    }
// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    if (file_exists($destinationPath)) {
        unlink($destinationPath);
    }
    error_log("Failed to submit payment: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while saving the payment transaction."
    ]);
}
?>
