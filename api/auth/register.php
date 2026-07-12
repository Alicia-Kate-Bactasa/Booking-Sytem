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
// Note: $_POST is used here instead of php://input because this is a multipart/form-data
// request that includes a binary file upload (proof_of_payment screenshot).
$name = isset($_POST['name']) ? trim($_POST['name']) : null;
$email = isset($_POST['email']) ? trim($_POST['email']) : null;
$password = isset($_POST['password']) ? $_POST['password'] : null;

// === SECTION: INPUT VALIDATION ===
if (empty($name) || empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. Name, email, and password are required fields."
    ]);
    exit();
}

// Check if email already exists in User table
try {
    $emailCheckQuery = "SELECT email FROM User WHERE email = :email LIMIT 1";
    $emailCheckStmt = $conn->prepare($emailCheckQuery);
    $emailCheckStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $emailCheckStmt->execute();
    if ($emailCheckStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "An account with this email address already exists."
        ]);
        exit();
    }
} catch (PDOException $e) {
    error_log("Email check failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while validating the email address."
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

// Verify actual Image MIME type to prevent malicious upload exploits
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

// Generate unique secure name for the file
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
    // Start database transaction
    $conn->beginTransaction();

    // 1. Generate unique username
    $emailPrefix = explode('@', $email)[0];
    $username = preg_replace('/[^a-zA-Z0-9_]/', '', $emailPrefix);
    if (strlen($username) < 3) {
        $username = 'user_' . substr(md5(uniqid()), 0, 8);
    }
    if (strlen($username) > 40) {
        $username = substr($username, 0, 40);
    }
    
    $origUsername = $username;
    $counter = 1;
    while (true) {
        $checkStmt = $conn->prepare("SELECT user_id FROM User WHERE username = :username LIMIT 1");
        $checkStmt->bindValue(':username', $username, PDO::PARAM_STR);
        $checkStmt->execute();
        if (!$checkStmt->fetch()) {
            break;
        }
        $username = substr($origUsername, 0, 35) . $counter;
        $counter++;
    }

    // 2. Insert into User table
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $userQuery = "INSERT INTO User (email, username, password, role) 
                  VALUES (:email, :username, :password, 'Customer')";
    $userStmt = $conn->prepare($userQuery);
    $userStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $userStmt->bindValue(':username', $username, PDO::PARAM_STR);
    $userStmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
    $userStmt->execute();
    $user_id = (int)$conn->lastInsertId();

    // 3. Insert into Customer table
    $customerQuery = "INSERT INTO Customer (user_id, full_name, phone_number, customer_type) 
                      VALUES (:user_id, :full_name, :phone_number, :customer_type)";
    $customerStmt = $conn->prepare($customerQuery);
    $customerStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
    $customerStmt->bindValue(':full_name', $name, PDO::PARAM_STR);
    $customerStmt->bindValue(':phone_number', 'N/A', PDO::PARAM_STR);
    $customerStmt->bindValue(':customer_type', 'Regular', PDO::PARAM_STR);
    $customerStmt->execute();
    $customer_id = (int)$conn->lastInsertId();

    // 4. Insert into Subscription table
    $subscriptionQuery = "INSERT INTO Subscription (customer_id, plan_tier, plan_status, last_billing_date, next_billing_date) 
                         VALUES (:customer_id, 'VIP Unlimited', 'Payment Pending', NULL, NULL)";
    $subscriptionStmt = $conn->prepare($subscriptionQuery);
    $subscriptionStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $subscriptionStmt->execute();
    $subscription_id = (int)$conn->lastInsertId();

    // 5. Insert into Invoice table (Subscription registration fee 1500 PHP)
    $invoiceQuery = "INSERT INTO Invoice (customer_id, total_amount, invoice_type, invoice_status) 
                     VALUES (:customer_id, 1500, 'Monthly Roster', 'Pending')";
    $invoiceStmt = $conn->prepare($invoiceQuery);
    $invoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $invoiceStmt->execute();
    $invoice_id = (int)$conn->lastInsertId();

    // 6. Insert into Payment table (Awaiting Admin approval)
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, 1500, 'GCash', :proof_of_payment, 'Pending Approval')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // Commit transaction
    $conn->commit();

    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "data" => [
            "message" => "Registration submitted successfully! Please wait for admin approval.",
            "customer_id" => $customer_id,
            "subscriber_id" => $subscription_id,
            "proof_path" => $databaseSavedPath
        ]
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    if (file_exists($destinationPath)) {
        unlink($destinationPath);
    }
    error_log("Subscriber registration transaction failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while saving the registration data. Please try again."
    ]);
}
?>
