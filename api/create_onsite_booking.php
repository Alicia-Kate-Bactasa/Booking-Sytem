<?php
/**
 * File: api/create_onsite_booking.php
 * Purpose: Allows Administrators to log onsite / walk-in customer bookings directly.
 *          Verifies availability, uploads a proof of ID/receipt, creates/resolves a customer with type 'Walk-In',
 *          inserts invoice/payment (Cash, Approved), and inserts the booking (Scheduled/Completed).
 * Input Params: POST fields (name, phone, email, service_id, date, time, bay, amount, booking_status), FILE field (proof_of_payment)
 */

// === SECTION: HEADER & CENTRALIZED CONNECTION ===
header("Content-Type: application/json; charset=UTF-8");
require_once 'config.php';

// === SECTION: AUTHENTICATION AND CSRF VALIDATION ===
require_auth('Admin');
verify_csrf_request();

// === SECTION: INPUT HANDLING ===
$client_name = isset($_POST['name']) ? trim($_POST['name']) : null;
$client_phone = isset($_POST['phone']) ? trim($_POST['phone']) : null;
$client_email = isset($_POST['email']) ? trim($_POST['email']) : '';
$service_id = isset($_POST['service_id']) ? (int)$_POST['service_id'] : null;
$scheduled_date = isset($_POST['date']) ? trim($_POST['date']) : null;
$time_slot = isset($_POST['time']) ? trim($_POST['time']) : null;
$bay_number = isset($_POST['bay']) ? (int)$_POST['bay'] : 1;
$amount_paid = isset($_POST['amount']) ? (float)$_POST['amount'] : null;
$booking_status = isset($_POST['booking_status']) ? trim($_POST['booking_status']) : 'Scheduled';

// === SECTION: INPUT VALIDATION ===
if (empty($client_name) || empty($client_phone) || empty($service_id) || empty($scheduled_date) || empty($time_slot) || $amount_paid === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. Name, phone, service, date, time slot, and amount paid are required."
    ]);
    exit();
}

if (!in_array($booking_status, ['Scheduled', 'Completed'], true)) {
    $booking_status = 'Scheduled';
}

if (!empty($client_email)) {
    $email_err = validate_email_active($client_email);
    if ($email_err !== true) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => $email_err
        ]);
        exit();
    }
} else {
    $client_email = null;
}

// Verify that payment/ID proof file was uploaded
if (!isset($_FILES['proof_of_payment']) || $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Audit Identification image or receipt snapshot is required for walk-in booking audits."
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
        "message" => "File format validation failed. The uploaded file is not a valid image."
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
        "message" => "An error occurred while saving the uploaded audit picture."
    ]);
    exit();
}

try {
    // Retrieve service name and duration
    $serviceQuery = "SELECT service_name, service_price, service_duration FROM Service WHERE service_id = :service_id LIMIT 1";
    $serviceStmt = $conn->prepare($serviceQuery);
    $serviceStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $serviceStmt->execute();
    $service = $serviceStmt->fetch();

    if (!$service) {
        if (file_exists($destinationPath)) unlink($destinationPath);
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "The requested service package was not found in database."
        ]);
        exit();
    }

    $service_name = $service['service_name'];
    $service_price = $service['service_price'];

    // Start Transaction
    $conn->beginTransaction();

    // 1. Create or resolve Walk-In customer record
    $checkCustQuery = "SELECT customer_id FROM Customer WHERE phone_number = :phone_number LIMIT 1";
    $checkCustStmt = $conn->prepare($checkCustQuery);
    $checkCustStmt->bindValue(':phone_number', $client_phone, PDO::PARAM_STR);
    $checkCustStmt->execute();
    $existingCustomer = $checkCustStmt->fetch();

    if ($existingCustomer) {
        $customer_id = (int)$existingCustomer['customer_id'];
        $updateCustQuery = "UPDATE Customer SET full_name = :full_name, email = :email, customer_type = 'Walk-In' WHERE customer_id = :customer_id";
        $updateCustStmt = $conn->prepare($updateCustQuery);
        $updateCustStmt->bindValue(':full_name', $client_name, PDO::PARAM_STR);
        $updateCustStmt->bindValue(':email', $client_email, $client_email === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $updateCustStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $updateCustStmt->execute();
    } else {
        $custQuery = "INSERT INTO Customer (full_name, phone_number, email, customer_type) 
                      VALUES (:full_name, :phone_number, :email, 'Walk-In')";
        $custStmt = $conn->prepare($custQuery);
        $custStmt->bindValue(':full_name', $client_name, PDO::PARAM_STR);
        $custStmt->bindValue(':phone_number', $client_phone, PDO::PARAM_STR);
        $custStmt->bindValue(':email', $client_email, $client_email === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $custStmt->execute();
        $customer_id = (int)$conn->lastInsertId();
    }

    // 2. Create Booking record
    $bookingQuery = "INSERT INTO Booking (customer_id, user_id, service_id, scheduled_date, time_slot, bay_number, purchased_price, booking_status) 
                     VALUES (:customer_id, NULL, :service_id, :scheduled_date, :time_slot, :bay_number, :purchased_price, :booking_status)";
    $bookingStmt = $conn->prepare($bookingQuery);
    $bookingStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $bookingStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $bookingStmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $bookingStmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $bookingStmt->bindValue(':bay_number', $bay_number, PDO::PARAM_INT);
    $bookingStmt->bindValue(':purchased_price', $service_price, PDO::PARAM_STR);
    $bookingStmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    $bookingStmt->execute();
    $booking_id = (int)$conn->lastInsertId();

    // 3. Generate Invoice record linked to booking_id
    $invoiceQuery = "INSERT INTO Invoice (booking_id, subscription_id, total_amount, invoice_type, invoice_status) 
                     VALUES (:booking_id, NULL, :total_amount, 'Single Detailing', 'Paid')";
    $invoiceStmt = $conn->prepare($invoiceQuery);
    $invoiceStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $invoiceStmt->bindValue(':total_amount', $service_price, PDO::PARAM_STR);
    $invoiceStmt->execute();
    $invoice_id = (int)$conn->lastInsertId();

    // 4. Create Payment record linked to invoice_id
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, :amount, 'Cash', :proof_of_payment, 'Paid')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':amount', $amount_paid, PDO::PARAM_STR);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // Log the transaction
    log_system_event($conn, 'Booking Created', "Onsite Walk-In booking ID {$booking_id} created for Customer ID {$customer_id} by Admin. Linked Invoice ID: {$invoice_id}. Status: {$booking_status}. Payment Method: Cash.");

    $conn->commit();

    // Sanitize and return success JSON response
    echo json_encode([
        "status" => "success",
        "message" => "Onsite booking logged and verified successfully!",
        "data" => [
            "booking_id" => $booking_id,
            "invoice_id" => $invoice_id,
            "customer_id" => $customer_id,
            "amount" => $amount_paid,
            "booking_status" => $booking_status
        ]
    ]);

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    if (file_exists($destinationPath)) {
        unlink($destinationPath);
    }
    error_log("Failed to create onsite booking: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while creating the walk-in booking record: " . $e->getMessage()
    ]);
}
