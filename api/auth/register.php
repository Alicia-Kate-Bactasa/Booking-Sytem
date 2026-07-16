<?php
/**
 * File: api/auth/register.php
 * Purpose: Handles step 2 of subscriber registration. Creates Customer, User, and Subscription records, 
 *          processes the uploaded GCash payment receipt image, saves it to the uploads folder,
 *          and sends a confirmation email to the subscriber.
 * Input Params: POST fields (name, email, password, confirm_password), FILE field (proof_of_payment)
 * Validation rules:
 *   - Fields must not be empty.
 *   - Name must contain only letters/spaces and be at least 3 characters.
 *   - Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols.
 *   - Email format validation, maximum size bounds checks.
 *   - GCash payment screenshot must be a valid image format (JPG, PNG, GIF, WEBP) and <= 8MB.
 *   - Email uniqueness check against existing User database records.
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
$name = isset($_POST['name']) ? trim($_POST['name']) : null;
$email = isset($_POST['email']) ? trim($_POST['email']) : null;
$password = isset($_POST['password']) ? $_POST['password'] : null;
$confirmPassword = isset($_POST['confirm_password']) ? $_POST['confirm_password'] : null;

// === SECTION: INPUT VALIDATION ===
if (empty($name) || empty($email) || empty($password) || empty($confirmPassword)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. Name, email, password, and confirm password are required fields."
    ]);
    exit();
}

if (!preg_match("/^[a-zA-Z\s]+$/", $name) || strlen($name) < 3) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Name must only contain letters and spaces, and be at least 3 characters long."
    ]);
    exit();
}

if (strlen($password) < 8 || 
    !preg_match("/[A-Z]/", $password) || 
    !preg_match("/[a-z]/", $password) || 
    !preg_match("/[0-9]/", $password) || 
    !preg_match("/[^a-zA-Z0-9]/", $password)) {
    
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    ]);
    exit();
}

if (strlen($email) > MAX_EMAIL_LENGTH) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Email must not exceed " . MAX_EMAIL_LENGTH . " characters."
    ]);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please provide a valid email address."
    ]);
    exit();
}

if (strlen($password) > MAX_PASSWORD_LENGTH) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must not exceed " . MAX_PASSWORD_LENGTH . " characters."
    ]);
    exit();
}

if ($password !== $confirmPassword) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password and confirm password must match."
    ]);
    exit();
}

// Check if email already exists in User table
$existingUser = null;
try {
    $emailCheckQuery = "SELECT u.user_id, u.customer_id, u.role, s.subscription_id, s.plan_status 
                        FROM User u 
                        LEFT JOIN Subscription s ON u.customer_id = s.customer_id 
                        WHERE u.email = :email LIMIT 1";
    $emailCheckStmt = $conn->prepare($emailCheckQuery);
    $emailCheckStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $emailCheckStmt->execute();
    $existingUser = $emailCheckStmt->fetch();

    if ($existingUser) {
        if ($existingUser['role'] === 'Admin' || in_array($existingUser['plan_status'], ['Active', 'Payment Pending', 'Cancellation Pending'])) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "An account with this email address already exists."
            ]);
            exit();
        }
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

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    if ($existingUser) {
        $customer_id = (int)$existingUser['customer_id'];
        $user_id = (int)$existingUser['user_id'];
        $subscription_id = $existingUser['subscription_id'] ? (int)$existingUser['subscription_id'] : null;

        // 1. Update Customer table (set customer_type to Regular since they are pending payment approval)
        $customerQuery = "UPDATE Customer SET full_name = :full_name, customer_type = 'Regular' WHERE customer_id = :customer_id";
        $customerStmt = $conn->prepare($customerQuery);
        $customerStmt->bindValue(':full_name', $name, PDO::PARAM_STR);
        $customerStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $customerStmt->execute();

        // 2. Update User table (password)
        $userQuery = "UPDATE User SET password = :password WHERE user_id = :user_id";
        $userStmt = $conn->prepare($userQuery);
        $userStmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
        $userStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $userStmt->execute();

        // 3. Update or Insert Subscription table
        if ($subscription_id) {
            $subscriptionQuery = "UPDATE Subscription 
                                  SET plan_tier = 'VIP Unlimited', plan_status = 'Payment Pending', last_billing_date = NULL, next_billing_date = NULL 
                                  WHERE subscription_id = :subscription_id";
            $subscriptionStmt = $conn->prepare($subscriptionQuery);
            $subscriptionStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
            $subscriptionStmt->execute();
        } else {
            $subscriptionQuery = "INSERT INTO Subscription (customer_id, plan_tier, plan_status, last_billing_date, next_billing_date) 
                                 VALUES (:customer_id, 'VIP Unlimited', 'Payment Pending', NULL, NULL)";
            $subscriptionStmt = $conn->prepare($subscriptionQuery);
            $subscriptionStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $subscriptionStmt->execute();
            $subscription_id = (int)$conn->lastInsertId();
        }
    } else {
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

        // 2. Insert into Customer table
        $customerQuery = "INSERT INTO Customer (full_name, phone_number, customer_type) 
                          VALUES (:full_name, :phone_number, :customer_type)";
        $customerStmt = $conn->prepare($customerQuery);
        $customerStmt->bindValue(':full_name', $name, PDO::PARAM_STR);
        $customerStmt->bindValue(':phone_number', 'N/A', PDO::PARAM_STR);
        $customerStmt->bindValue(':customer_type', 'Regular', PDO::PARAM_STR);
        $customerStmt->execute();
        $customer_id = (int)$conn->lastInsertId();

        // 3. Insert into User table
        $userQuery = "INSERT INTO User (customer_id, email, username, password, role) 
                      VALUES (:customer_id, :email, :username, :password, 'Customer')";
        $userStmt = $conn->prepare($userQuery);
        $userStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $userStmt->bindValue(':email', $email, PDO::PARAM_STR);
        $userStmt->bindValue(':username', $username, PDO::PARAM_STR);
        $userStmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
        $userStmt->execute();
        $user_id = (int)$conn->lastInsertId();

        // 4. Insert into Subscription table
        $subscriptionQuery = "INSERT INTO Subscription (customer_id, plan_tier, plan_status, last_billing_date, next_billing_date) 
                             VALUES (:customer_id, 'VIP Unlimited', 'Payment Pending', NULL, NULL)";
        $subscriptionStmt = $conn->prepare($subscriptionQuery);
        $subscriptionStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $subscriptionStmt->execute();
        $subscription_id = (int)$conn->lastInsertId();
    }

    // 5. Insert into Invoice table (Subscription registration fee 1500 PHP)
    $invoiceQuery = "INSERT INTO Invoice (subscription_id, total_amount, invoice_type, invoice_status) 
                     VALUES (:subscription_id, 1500, 'Monthly Roster', 'Pending')";
    $invoiceStmt = $conn->prepare($invoiceQuery);
    $invoiceStmt->bindValue(':subscription_id', $subscription_id, PDO::PARAM_INT);
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

    // Send pending subscription registration invoice
    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        $subject = "Subscription Registration Pending - Montage Auto Studio";

        $invoiceData = [
            'title' => 'Pro-forma Invoice',
            'invoice_no' => 'INV-' . $invoice_id,
            'date' => date('Y-m-d'),
            'client_name' => $name,
            'client_email' => $email,
            'item_name' => 'VIP Unlimited Plan',
            'item_subtext' => 'Monthly subscription plan with priority scheduling.',
            'item_price' => 1500.00,
            'subtotal' => 1500.00,
            'total_due' => 1500.00,
            'status_bg' => '#fef9e7',
            'status_border' => '#f39c12',
            'status_color' => '#d35400',
            'status_label' => 'PENDING VERIFICATION',
            'status_detail' => 'We have received your VIP membership registration and payment screenshot. Please allow 24-48 hours for administrative approval.'
        ];

        $htmlContent = Mailer::formatInvoice($invoiceData);
        Mailer::send($email, $subject, $htmlContent);
    }

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
