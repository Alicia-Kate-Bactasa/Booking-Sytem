<?php
/**
 * File: api/bookings/update_booking.php
 * Purpose: Allows administrators to update attributes (date, time slot, bay, status) of an active booking.
 * Input Params: JSON body (booking_id, scheduled_date, time_slot, bay_number, booking_status)
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - Booking status parameter must match allowed ENUM values.
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
    $checkQuery = "SELECT b.booking_id, b.customer_id, i.invoice_id, 
                          CASE WHEN b.user_id IS NOT NULL THEN 'Subscriber' ELSE COALESCE(c.customer_type, 'Regular') END AS customer_type, 
                          b.booking_status AS current_status,
                          CASE WHEN b.user_id IS NOT NULL THEN u.email ELSE c.email END AS customer_email, 
                          CASE WHEN b.user_id IS NOT NULL THEN u.username ELSE c.full_name END AS customer_name,
                          s.service_name, b.scheduled_date, b.time_slot, b.purchased_price
                   FROM Booking b
                   LEFT JOIN Customer c ON b.customer_id = c.customer_id
                   LEFT JOIN User u ON b.user_id = u.user_id
                   JOIN Service s ON b.service_id = s.service_id
                   LEFT JOIN Invoice i ON b.booking_id = i.booking_id
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
        
        // Send email notification on Completion or Cancellation
        if (($booking_status === 'Completed' || $booking_status === 'Cancelled') && !empty($bookingData['customer_email']) && filter_var($bookingData['customer_email'], FILTER_VALIDATE_EMAIL)) {
            require_once __DIR__ . '/../utils/mailer.php';
            
            $email = $bookingData['customer_email'];
            $name = $bookingData['customer_name'] ?: 'Valued Client';
            $service = $bookingData['service_name'];
            $date = $bookingData['scheduled_date'];
            $time = $bookingData['time_slot'];
            $bookingRef = 'MTG-' . $booking_id;
            
            // Calculate invoice pricing: 0.00 for subscribers, else use the booking purchased_price
            $price = ($bookingData['customer_type'] === 'Subscriber') ? 0.00 : (float)$bookingData['purchased_price'];

            if ($booking_status === 'Completed') {
                $subject = "Thank You for Visiting Montage Auto Studio - Booking Ref: " . $bookingRef;
                $html = Mailer::formatInvoice([
                    'title' => 'Service Completed',
                    'status_bg' => '#f4fbf7',
                    'status_border' => '#27ae60',
                    'status_color' => '#27ae60',
                    'status_label' => 'COMPLETED',
                    'status_detail' => "Dear {$name}, thank you for choosing Montage Auto Studio! Your detailing session for <strong>{$service}</strong> is now completed. We hope you are thrilled with the results!",
                    'booking_id' => $booking_id,
                    'invoice_no' => $bookingRef,
                    'date' => date('Y-m-d'),
                    'client_name' => $name,
                    'client_email' => $email,
                    'item_name' => $service,
                    'item_subtext' => "Scheduled Date: {$date} | Time: {$time}",
                    'item_price' => $price,
                    'subtotal' => $price,
                    'total_due' => $price
                ]);
            } else {
                $subject = "Booking Cancellation Notice - Booking Ref: " . $bookingRef;
                $html = Mailer::formatInvoice([
                    'title' => 'Booking Cancelled',
                    'status_bg' => '#fdf2f2',
                    'status_border' => '#c0392b',
                    'status_color' => '#c0392b',
                    'status_label' => 'CANCELLED',
                    'status_detail' => "Dear {$name}, your booking reference <strong>{$bookingRef}</strong> for <strong>{$service}</strong> scheduled on {$date} at {$time} has been cancelled successfully. If this was a mistake, please reach out to us.",
                    'booking_id' => $booking_id,
                    'invoice_no' => $bookingRef,
                    'date' => date('Y-m-d'),
                    'client_name' => $name,
                    'client_email' => $email,
                    'item_name' => $service,
                    'item_subtext' => "Original Schedule: {$date} at {$time}",
                    'item_price' => $price,
                    'subtotal' => $price,
                    'total_due' => $price
                ]);
            }
            try {
                Mailer::send($email, $subject, $html);
            } catch (Exception $mailEx) {
                error_log("Failed to send booking update email: " . $mailEx->getMessage());
            }
        }
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
