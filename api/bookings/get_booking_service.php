<?php
/**
 * File: api/bookings/get_booking_service.php
 * Purpose: Retrieves the service name associated with a Booking ID (public access for feedback).
 * Input Params: GET ?booking_id=123 (or MTG-123)
 * Output: JSON response returning the service name.
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method Not Allowed."]);
    exit();
}

$booking_id_raw = isset($_GET['booking_id']) ? trim($_GET['booking_id']) : '';

if (empty($booking_id_raw)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Booking ID is required."]);
    exit();
}

// Clean prefix
$booking_id_raw = str_replace('MTG-', '', $booking_id_raw);

if (!filter_var($booking_id_raw, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid Booking ID format."]);
    exit();
}

$booking_id = (int)$booking_id_raw;

try {
    $query = "SELECT s.service_name 
              FROM Booking b 
              JOIN Service s ON b.service_id = s.service_id 
              WHERE b.booking_id = :booking_id LIMIT 1";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $stmt->execute();
    $booking = $stmt->fetch();

    if (!$booking) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Booking ID not found."]);
        exit();
    }

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => [
            "service_name" => $booking['service_name']
        ]
    ]);
} catch (PDOException $e) {
    error_log("Failed to fetch booking service: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Server error."]);
}
?>
