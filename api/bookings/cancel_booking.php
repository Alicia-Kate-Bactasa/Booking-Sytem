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
    $checkQuery = "SELECT booking_id, customer_id, booking_status FROM Booking WHERE booking_id = :booking_id LIMIT 1";
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
