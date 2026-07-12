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
$inputData = json_decode(file_get_contents("php://input"), true);

if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

$booking_id = isset($inputData['booking_id']) ? $inputData['booking_id'] : null;
$booking_status = isset($inputData['booking_status']) ? trim($inputData['booking_status']) : (isset($inputData['status']) ? trim($inputData['status']) : null);

// === SECTION: INPUT VALIDATION ===
if (empty($booking_id) || empty($booking_status)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id and booking_status are required fields."
    ]);
    exit();
}

$validStatuses = ['Pending', 'Pending Verification', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'];
if (!in_array($booking_status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid booking status. Allowed values are: " . implode(", ", $validStatuses)
    ]);
    exit();
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Only allow verified Admin users to update booking statuses
    require_auth('Admin');
    verify_csrf_request();

    // Check if the booking actually exists before updating and fetch details
    $checkQuery = "SELECT b.booking_id, b.customer_id, b.invoice_id, c.customer_type, b.booking_status AS current_status 
                   FROM Booking b
                   JOIN Customer c ON b.customer_id = c.customer_id
                   WHERE b.booking_id = :booking_id LIMIT 1";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $checkStmt->execute();
    $bookingData = $checkStmt->fetch();
    
    if (!$bookingData) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Booking record not found with ID " . htmlspecialchars($booking_id)
        ]);
        exit();
    }

    // State Machine Integrity Validation (Regular customer must have Paid invoice to move to Pending/Confirmed/Completed/Scheduled)
    if ($bookingData['customer_type'] === 'Regular' && in_array($booking_status, ['Pending', 'Confirmed', 'Completed'], true)) {
        if ($bookingData['invoice_id'] !== null) {
            // Verify if the invoice status is Paid
            $invQuery = "SELECT invoice_status FROM Invoice WHERE invoice_id = :invoice_id LIMIT 1";
            $invStmt = $conn->prepare($invQuery);
            $invStmt->bindValue(':invoice_id', $bookingData['invoice_id'], PDO::PARAM_INT);
            $invStmt->execute();
            $invoice = $invStmt->fetch();

            if (!$invoice || $invoice['invoice_status'] !== 'Paid') {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "message" => "Cannot schedule or complete this booking. The associated payment for Invoice ID " . $bookingData['invoice_id'] . " has not been verified/approved as Paid yet."
                ]);
                exit();
            }
        }
    }

    // Prepare and execute update
    $query = "UPDATE Booking SET booking_status = :booking_status WHERE booking_id = :booking_id";
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    $stmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    
    if ($stmt->execute()) {
        log_system_event($conn, 'Booking Updated', "Booking ID {$booking_id} status updated from {$bookingData['current_status']} to {$booking_status} by Admin.");
        // === SECTION: SUCCESS RESPONSE ===
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "data" => [
                "message" => "Booking status updated successfully!",
                "booking_id" => $booking_id,
                "booking_status" => $booking_status
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to update booking status. Database transaction failed."
        ]);
    }

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to update booking status: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while updating the booking status."
    ]);
}
?>
