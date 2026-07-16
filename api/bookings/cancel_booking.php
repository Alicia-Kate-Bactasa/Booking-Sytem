<?php
/**
 * File: api/bookings/cancel_booking.php
 * Purpose: Allows customers (subscribers) or administrators to cancel an upcoming booked detailing appointment.
 * Input Params: JSON body (booking_id)
 * Validation rules:
 *   - The user session must be authenticated.
 *   - Subscribers can only cancel their own bookings (ownership check).
 * Output: JSON response indicating success or specific cancellation error.
 */

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

$inputData = json_decode(file_get_contents("php://input"), true);

if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

$booking_id = isset($inputData['booking_id']) ? (int)$inputData['booking_id'] : null;

if (empty($booking_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id is required."
    ]);
    exit();
}

try {
    // Require authentication
    require_auth(['Subscriber', 'Admin']);
    verify_csrf_request();

    // 1. Verify the booking exists
    $checkQuery = "SELECT b.booking_id, b.customer_id, b.booking_status,
                          COALESCE(u.email, c.email) AS customer_email, c.full_name AS customer_name,
                          s.service_name, b.scheduled_date, b.time_slot
                   FROM Booking b
                   JOIN Customer c ON b.customer_id = c.customer_id
                   LEFT JOIN User u ON c.customer_id = u.customer_id
                   JOIN Service s ON b.service_id = s.service_id
                   WHERE b.booking_id = :booking_id LIMIT 1";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $checkStmt->execute();
    $booking = $checkStmt->fetch();

    if (!$booking) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Booking record not found."
        ]);
        exit();
    }

    // 2. Enforce subscriber ownership check
    if ($_SESSION['role'] === 'Subscriber' && (int)$booking['customer_id'] !== (int)$_SESSION['customer_id']) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Forbidden. You do not own this booking."
        ]);
        exit();
    }

    // 3. Prevent cancellation of already finalized/cancelled bookings
    if (in_array($booking['booking_status'], ['Completed', 'Cancelled', 'No-Show'], true)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid Action. Booking is already completed, cancelled, or flagged as no-show."
        ]);
        exit();
    }

    // Start Transaction
    $conn->beginTransaction();

    // 4. Update the Booking status to 'Cancelled'
    $updateQuery = "UPDATE Booking SET booking_status = 'Cancelled' WHERE booking_id = :booking_id";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $updateStmt->execute();

    log_system_event($conn, 'Booking Cancelled', "Booking ID {$booking_id} status updated to Cancelled by Subscriber.");
    
    // Send email notification on Cancellation
    if (!empty($booking['customer_email']) && filter_var($booking['customer_email'], FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        
        $email = $booking['customer_email'];
        $name = $booking['customer_name'] ?: 'Valued Client';
        $service = $booking['service_name'];
        $date = $booking['scheduled_date'];
        $time = $booking['time_slot'];
        $bookingRef = 'MTG-' . $booking_id;
        
        $subject = "Booking Cancellation Notice - Booking Ref: " . $bookingRef;
        $html = Mailer::formatInvoice([
            'title' => 'Booking Cancelled',
            'status_bg' => '#fdf2f2',
            'status_border' => '#c0392b',
            'status_color' => '#c0392b',
            'status_label' => 'CANCELLED',
            'status_detail' => "Dear {$name}, your booking reference <strong>{$bookingRef}</strong> for <strong>{$service}</strong> scheduled on {$date} at {$time} has been cancelled successfully.",
            'invoice_no' => $bookingRef,
            'date' => date('Y-m-d'),
            'client_name' => $name,
            'client_email' => $email,
            'item_name' => $service,
            'item_subtext' => "Original Schedule: {$date} at {$time}",
            'item_price' => 0.00,
            'subtotal' => 0.00,
            'total_due' => 0.00
        ]);
        try {
            Mailer::send($email, $subject, $html);
        } catch (Exception $mailEx) {
            error_log("Failed to send booking cancellation email: " . $mailEx->getMessage());
        }
    }
    
    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "Appointment session cancelled successfully!"
    ]);

} catch (Exception $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Cancellation failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while cancelling your session: " . $e->getMessage()
    ]);
}
?>
