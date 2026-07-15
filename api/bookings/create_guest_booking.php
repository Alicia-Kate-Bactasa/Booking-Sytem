<?php
/**
 * File: api/bookings/create_guest_booking.php
 * Purpose: Processes and registers appointment bookings for guest (unregistered) clients.
 *          Saves the GCash proof of payment screenshot, registers a Customer account, creates a pending Detailing Invoice/Payment,
 *          logs system events, and sends an HTML invoice confirmation email highlighting their Booking Reference ID.
 * Input Params: POST fields (name, email, phone, service_id, date, slot, bay), FILE field (proof_of_payment)
 * Validation rules:
 *   - Inputs must not be empty.
 *   - Booking date must be today or in the future (no past bookings allowed).
 *   - The name, email, and phone structure patterns must be valid.
 *   - GCash payment screenshot must be a valid image format (JPG, PNG, GIF, WEBP) and <= 8MB.
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
// Note: $_POST is used because this is a multipart/form-data request with binary file upload.
$client_name = isset($_POST['name']) ? trim($_POST['name']) : null;
$client_phone = isset($_POST['phone']) ? trim($_POST['phone']) : null;
$client_email = isset($_POST['email']) ? trim($_POST['email']) : null;
$service_name = isset($_POST['service_name']) ? trim($_POST['service_name']) : null;
$scheduled_date = isset($_POST['date']) ? trim($_POST['date']) : null;
$time_slot = isset($_POST['time']) ? trim($_POST['time']) : null;

// === SECTION: INPUT VALIDATION ===
if (empty($client_name) || empty($client_phone) || empty($client_email) || empty($service_name) || empty($scheduled_date) || empty($time_slot)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. Name, phone, email, service, date, and time slot are required fields."
    ]);
    exit();
}

if (strtotime($scheduled_date) < strtotime(date('Y-m-d'))) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Booking date cannot be in the past."
    ]);
    exit();
}

if (!filter_var($client_email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid email address format."
    ]);
    exit();
}

// Verify that payment proof file was uploaded
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

// Helper function to convert time slot (e.g. "09:00 AM") to minutes since midnight
if (!function_exists('getMinutesFromSlot')) {
    function getMinutesFromSlot($timeStr) {
        $timeStr = trim($timeStr);
        $parts = explode(' ', $timeStr);
        if (count($parts) < 2) return 0;
        $hm = explode(':', $parts[0]);
        $h = (int)$hm[0];
        $m = isset($hm[1]) ? (int)$hm[1] : 0;
        $ampm = strtoupper($parts[1]);
        
        if ($ampm === 'PM' && $h !== 12) {
            $h += 12;
        }
        if ($ampm === 'AM' && $h === 12) {
            $h = 0;
        }
        return $h * 60 + $m;
    }
}

try {
    $conn->beginTransaction();

    // 1. Retrieve the service by name
    $serviceQuery = "SELECT service_id, service_price, service_duration FROM Service WHERE service_name = :service_name LIMIT 1";
    $serviceStmt = $conn->prepare($serviceQuery);
    $serviceStmt->bindValue(':service_name', $service_name, PDO::PARAM_STR);
    $serviceStmt->execute();
    $service = $serviceStmt->fetch();

    if (!$service) {
        if (file_exists($destinationPath)) unlink($destinationPath);
        $conn->rollBack();
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "The requested service package was not found."
        ]);
        exit();
    }

    $service_id = (int)$service['service_id'];
    $purchased_price = $service['service_price'];
    $duration = (int)$service['service_duration'];

    // 2. Perform capacity-aware non-overlap check on Bay 1
    $new_start = getMinutesFromSlot($time_slot);
    $new_end = $new_start + $duration;

    $overlapQuery1 = "SELECT b.booking_id 
                      FROM Booking b
                      JOIN Service s ON b.service_id = s.service_id
                      WHERE b.scheduled_date = :date 
                        AND b.bay_number = 'Bay 1' 
                        AND b.booking_status NOT IN ('Cancelled', 'No-Show')
                        AND (
                          (TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) < :new_end 
                          AND 
                          ((TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) + s.service_duration) > :new_start
                        ) LIMIT 1";
    $overlapStmt1 = $conn->prepare($overlapQuery1);
    $overlapStmt1->bindValue(':date', $scheduled_date, PDO::PARAM_STR);
    $overlapStmt1->bindValue(':new_start', $new_start, PDO::PARAM_INT);
    $overlapStmt1->bindValue(':new_end', $new_end, PDO::PARAM_INT);
    $overlapStmt1->execute();
    $bay1Occupied = $overlapStmt1->fetch();

    $bay_number = null;
    if (!$bay1Occupied) {
        $bay_number = 'Bay 1';
    } else {
        // Check Bay 2
        $overlapQuery2 = "SELECT b.booking_id 
                          FROM Booking b
                          JOIN Service s ON b.service_id = s.service_id
                          WHERE b.scheduled_date = :date 
                            AND b.bay_number = 'Bay 2' 
                            AND b.booking_status NOT IN ('Cancelled', 'No-Show')
                            AND (
                              (TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) < :new_end 
                              AND 
                              ((TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) + s.service_duration) > :new_start
                            ) LIMIT 1";
        $overlapStmt2 = $conn->prepare($overlapQuery2);
        $overlapStmt2->bindValue(':date', $scheduled_date, PDO::PARAM_STR);
        $overlapStmt2->bindValue(':new_start', $new_start, PDO::PARAM_INT);
        $overlapStmt2->bindValue(':new_end', $new_end, PDO::PARAM_INT);
        $overlapStmt2->execute();
        $bay2Occupied = $overlapStmt2->fetch();

        if (!$bay2Occupied) {
            $bay_number = 'Bay 2';
        } else {
            if (file_exists($destinationPath)) unlink($destinationPath);
            $conn->rollBack();
            http_response_code(409); // Conflict
            echo json_encode([
                "status" => "error",
                "message" => "The selected time slot is fully booked. Please select a different time slot or date."
            ]);
            exit();
        }
    }

    // 3. Create guest Customer
    $custQuery = "INSERT INTO Customer (full_name, phone_number, email, customer_type) 
                  VALUES (:full_name, :phone_number, :email, 'Regular')";
    $custStmt = $conn->prepare($custQuery);
    $custStmt->bindValue(':full_name', $client_name, PDO::PARAM_STR);
    $custStmt->bindValue(':phone_number', $client_phone, PDO::PARAM_STR);
    $custStmt->bindValue(':email', $client_email, PDO::PARAM_STR);
    $custStmt->execute();
    $customer_id = (int)$conn->lastInsertId();

    // 4. Create Invoice
    $invoiceQuery = "INSERT INTO Invoice (subscription_id, total_amount, invoice_type, invoice_status) 
                     VALUES (NULL, :total_amount, 'Single Detailing', 'Pending')";
    $invoiceStmt = $conn->prepare($invoiceQuery);
    $invoiceStmt->bindValue(':total_amount', $purchased_price, PDO::PARAM_STR);
    $invoiceStmt->execute();
    $invoice_id = (int)$conn->lastInsertId();

    // 5. Create Booking
    $bookingQuery = "INSERT INTO Booking (customer_id, service_id, invoice_id, scheduled_date, time_slot, bay_number, purchased_price, booking_status) 
                     VALUES (:customer_id, :service_id, :invoice_id, :scheduled_date, :time_slot, :bay_number, :purchased_price, 'Pending Verification')";
    $bookingStmt = $conn->prepare($bookingQuery);
    $bookingStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $bookingStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $bookingStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $bookingStmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $bookingStmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $bookingStmt->bindValue(':bay_number', $bay_number, PDO::PARAM_STR);
    $bookingStmt->bindValue(':purchased_price', $purchased_price, PDO::PARAM_STR);
    $bookingStmt->execute();
    $booking_id = (int)$conn->lastInsertId();

    // 6. Create Payment Record
    $paymentQuery = "INSERT INTO Payment (invoice_id, amount, payment_method, proof_of_payment, payment_status) 
                     VALUES (:invoice_id, :amount, 'GCash', :proof_of_payment, 'Pending Approval')";
    $paymentStmt = $conn->prepare($paymentQuery);
    $paymentStmt->bindValue(':invoice_id', $invoice_id, PDO::PARAM_INT);
    $paymentStmt->bindValue(':amount', $purchased_price, PDO::PARAM_STR);
    $paymentStmt->bindValue(':proof_of_payment', $databaseSavedPath, PDO::PARAM_STR);
    $paymentStmt->execute();

    // 7. Log system event
    log_system_event($conn, 'Booking Created', "Guest booking ID {$booking_id} created for Customer ID {$customer_id} (Regular). Status: Pending Verification. Linked Invoice ID: {$invoice_id}.");

    $conn->commit();

    // Send booking confirmation email to guest client
    if ($client_email && filter_var($client_email, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        $subject = "Booking Received - Montage Auto Studio";

        $invoiceData = [
            'title' => 'Booking Invoice',
            'invoice_no' => 'INV-' . $invoice_id,
            'date' => date('Y-m-d'),
            'client_name' => $client_name,
            'client_email' => $client_email,
            'item_name' => $service_name,
            'item_subtext' => "Scheduled for {$bay_number} on {$scheduled_date} at {$time_slot}",
            'item_price' => (float)$purchased_price,
            'subtotal' => (float)$purchased_price,
            'total_due' => (float)$purchased_price,
            'status_bg' => '#fef9e7',
            'status_border' => '#f39c12',
            'status_color' => '#d35400',
            'status_label' => 'PENDING VERIFICATION',
            'status_detail' => 'We have received your guest booking request. Please allow our team 24-48 hours to review your GCash payment screenshot.',
            'booking_id' => $booking_id
        ];

        $htmlContent = Mailer::formatInvoice($invoiceData);
        Mailer::send($client_email, $subject, $htmlContent);
    }

    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "data" => [
            "message" => "Booking successfully submitted!",
            "booking_id" => "MTG-" . $booking_id,
            "invoice_id" => "INV-" . $invoice_id,
            "client" => $client_name,
            "service" => $service_name,
            "date" => $scheduled_date,
            "time" => $time_slot,
            "bay" => $bay_number,
            "price" => $purchased_price
        ]
    ]);

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    if (file_exists($destinationPath)) {
        unlink($destinationPath);
    }
    error_log("Failed to create guest booking: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while saving the booking in the database. " . $e->getMessage()
    ]);
}
?>
