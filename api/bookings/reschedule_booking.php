<?php
/**
 * File: api/bookings/reschedule_booking.php
 * Purpose: Allows customers or administrators to update the scheduled date and time slot of an active booking.
 * Input Params: JSON body (booking_id, new_date, new_slot, new_bay)
 * Validation rules:
 *   - The user session must be authenticated.
 *   - The reschedule target date must be today or in the future (no rescheduling into past dates).
 *   - The capacity limit for the target slot must not be exceeded.
 * Output: JSON response indicating success or specific rescheduled slot validation error.
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
$scheduled_date = isset($inputData['scheduled_date']) ? trim($inputData['scheduled_date']) : null;
$time_slot = isset($inputData['time_slot']) ? trim($inputData['time_slot']) : null;

if (empty($booking_id) || empty($scheduled_date) || empty($time_slot)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id, scheduled_date, and time_slot are required."
    ]);
    exit();
}

if (strtotime($scheduled_date) < strtotime(date('Y-m-d'))) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Reschedule date cannot be in the past."
    ]);
    exit();
}

// Helper to convert time slot to minutes
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
    // Require authentication
    require_auth(['Subscriber', 'Admin']);
    verify_csrf_request();

    // 1. Verify the booking exists and fetch client details for notification email
    $checkQuery = "SELECT b.booking_id, b.customer_id, b.user_id, b.service_id, b.booking_status, 
                          s.service_duration, s.service_name, b.scheduled_date AS old_date, b.time_slot AS old_slot,
                          c.full_name AS customer_name, c.email AS customer_email
                   FROM Booking b
                   JOIN Service s ON b.service_id = s.service_id
                   JOIN Customer c ON b.customer_id = c.customer_id
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
    if ($_SESSION['role'] === 'Subscriber' && (int)$booking['user_id'] !== (int)$_SESSION['user_id']) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Forbidden. You do not own this booking."
        ]);
        exit();
    }

    // 3. Prevent rescheduling of finished or cancelled bookings
    if (in_array($booking['booking_status'], ['Completed', 'Cancelled', 'No-Show'], true)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid Action. Finished, cancelled, or no-show bookings cannot be rescheduled."
        ]);
        exit();
    }

    // 4. Validate Sunday Constraint
    if (date('N', strtotime($scheduled_date)) == 7) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Scheduling Constraint Violation: Montage Auto Studio operates strictly Mon-Sat. Sunday slots are unavailable."
        ]);
        exit();
    }

    // Start Transaction
    $conn->beginTransaction();

    // 5. Evaluate bay availability on the target slot (excluding current booking to prevent self-overlap)
    $duration = (int)$booking['service_duration'];
    $newStart = getMinutesFromSlot($time_slot);
    $newEnd = $newStart + $duration;

    // Fetch other active bookings on target date
    $query = "SELECT b.time_slot, s.service_duration, b.bay_number 
              FROM Booking b
              JOIN Service s ON b.service_id = s.service_id
              WHERE b.scheduled_date = :scheduled_date 
                AND b.booking_id != :booking_id
                AND b.booking_status NOT IN ('Cancelled', 'No-Show')";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $stmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $stmt->execute();
    $existingBookings = $stmt->fetchAll();

    $bay1Free = true;
    $bay2Free = true;

    foreach ($existingBookings as $eb) {
        $ebStart = getMinutesFromSlot($eb['time_slot']);
        $ebEnd = $ebStart + (int)$eb['service_duration'];

        if ($newStart < $ebEnd && $ebStart < $newEnd) {
            if ((int)$eb['bay_number'] === 1) {
                $bay1Free = false;
            }
            if ((int)$eb['bay_number'] === 2) {
                $bay2Free = false;
            }
        }
    }

    if (!$bay1Free && !$bay2Free) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Reschedule Blocked: This slot is fully booked on the selected date. Please choose another time slot."
        ]);
        exit();
    }

    $allocatedBay = $bay1Free ? 1 : 2;

    // 6. Update the Booking
    $updateQuery = "UPDATE Booking 
                    SET scheduled_date = :scheduled_date, 
                        time_slot = :time_slot, 
                        bay_number = :bay_number 
                    WHERE booking_id = :booking_id";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $updateStmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $updateStmt->bindValue(':bay_number', $allocatedBay, PDO::PARAM_INT);
    $updateStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $updateStmt->execute();

    log_system_event($conn, 'Booking Rescheduled', "Booking ID {$booking_id} rescheduled to {$scheduled_date} at {$time_slot} ({$allocatedBay}).");
    $conn->commit();

    // 7. Dispatch Email Notification to Client
    $email = $booking['customer_email'];
    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        require_once __DIR__ . '/../utils/mailer.php';
        
        $customerName = $booking['customer_name'] ?: 'Valued Customer';
        $serviceName = $booking['service_name'];
        $cleanBookingRef = 'MTG-' . $booking_id;

        $subject = "Appointment Rescheduled Confirmation - " . $cleanBookingRef;
        $htmlContent = Mailer::formatInvoice([
            'title' => 'Reschedule Confirmed',
            'status_bg' => '#e8f4fd',
            'status_border' => '#2980b9',
            'status_color' => '#2980b9',
            'status_label' => 'RESCHEDULED',
            'status_detail' => "Dear {$customerName}, your appointment for <strong>{$serviceName}</strong> has been successfully rescheduled to a new slot.<br><br><strong>New Schedule:</strong><br>📅 Date: {$scheduled_date}<br>🕒 Time: {$time_slot}<br><br><em>(Previous Schedule: {$booking['old_date']} at {$booking['old_slot']})</em>",
            'invoice_no' => $cleanBookingRef,
            'date' => date('Y-m-d'),
            'client_name' => $customerName,
            'client_email' => $email,
            'item_name' => $serviceName,
            'item_subtext' => "Rescheduled detailing session.",
            'item_price' => 0.00,
            'subtotal' => 0.00,
            'total_due' => 0.00,
            'booking_id' => $booking_id
        ]);

        try {
            Mailer::send($email, $subject, $htmlContent);
        } catch (Exception $mailEx) {
            error_log("Failed to send reschedule email: " . $mailEx->getMessage());
        }
    }

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "Appointment rescheduled successfully!",
        "data" => [
            "booking_id" => $booking_id,
            "scheduled_date" => $scheduled_date,
            "time_slot" => $time_slot,
            "bay_number" => $allocatedBay
        ]
    ]);

} catch (Exception $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Reschedule failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while rescheduling the booking."
    ]);
}
?>
