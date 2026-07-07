<?php
/**
 * Submit Payment Endpoint
 * 
 * Handles incoming multipart form-data requests to register a GCash payment transaction.
 * Uploads the proof-of-payment image file securely (verifying file types, MIME types, and sizes)
 * to a dedicated uploads folder, then saves the payment record to the database with a default
 * status of 'Pending Approval'.
 */

// Include database configuration and CORS headers
require_once __DIR__ . '/config.php';

// Validate HTTP request method (Multipart form-data must be sent via POST)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

// Extract post fields (Since this is multipart/form-data, PHP populates $_POST and $_FILES)
$invoice_id = isset($_POST['invoice_id']) ? $_POST['invoice_id'] : null;
$amount = isset($_POST['amount']) ? $_POST['amount'] : null;
$payment_method = isset($_POST['payment_method']) ? trim($_POST['payment_method']) : 'GCash';

// Validate basic parameters
if (empty($invoice_id) || empty($amount)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. invoice_id and amount are required fields."
    ]);
    exit();
}

// Validate ID and Amount formats
if (!filter_var($invoice_id, FILTER_VALIDATE_INT) || !filter_var($amount, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid input format. invoice_id and amount must be numeric integers."
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

// 1. Validate File Size (Limit to 8MB)
$maxFileSize = 8 * 1024 * 1024; // 8 Megabytes
if ($fileSize > $maxFileSize) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "File size exceeds the allowable limit of 8MB."
    ]);
    exit();
}

// 2. Validate File Extension
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

// 3. Verify actual Image MIME type to prevent malicious code injection disguised as image
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
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to create uploads directory on the server."
        ]);
        exit();
    }
}

// Generate a cryptographically secure, unique name for the file to prevent overwrite/execution exploits
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

try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);

    // Check if the referenced invoice exists and get its customer_id
    $invoiceCheckQuery = "SELECT invoice_id, customer_id FROM Invoice WHERE invoice_id = :invoice_id";
    $invoiceCheckStmt = $conn->prepare($invoiceCheckQuery);
    $invoiceCheckStmt->execute([':invoice_id' => $invoice_id]);
    $invoice = $invoiceCheckStmt->fetch();
    
    if (!$invoice) {
        // Delete uploaded file if the database reference is invalid
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

    // If the authenticated user is a Subscriber, ensure they own this invoice
    if ($_SESSION['role'] === 'Subscriber' && (int)$invoice['customer_id'] !== $_SESSION['customer_id']) {
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

    // Default status for GCash payments is 'Pending Approval'
    $payment_status = 'Pending Approval';

    // Insert payment record
    $query = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
              VALUES (:invoice_id, :amount, :payment_method, :proof_of_payment, :payment_status)";
              
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $stmt->bindValue(':amount', $amount, PDO::PARAM_INT);
    $stmt->bindValue(':payment_method', $payment_method, PDO::PARAM_STR);
    $stmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $stmt->bindValue(':payment_status', $payment_status, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "message" => "Payment transaction submitted successfully! Awaiting verification.",
            "payment_id" => (int)$conn->lastInsertId(),
            "proof_path" => $databaseSavedPath
        ]);
    } else {
        // Delete uploaded file if database insertion fails
        if (file_exists($destinationPath)) {
            unlink($destinationPath);
        }
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to write payment record to the database."
        ]);
    }
} catch (PDOException $e) {
    // Delete file in case of exception to keep server directories clean
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
