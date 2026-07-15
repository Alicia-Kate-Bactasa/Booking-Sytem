<?php
/**
 * File: api/services/check_service_bookings.php
 * Purpose: Allows administrators to check if a service package has any active scheduled bookings in the future.
 *          Used as a safeguard warning prompt when administrators change service durations.
 * Input Params: GET or POST (service_name)
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - Service name parameter must be present.
 * Output: JSON response returning count of active future bookings.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET or POST requests are accepted."
    ]);
    exit();
}

// Require admin privilege
try {
    require_auth('Admin');
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => "error",
        "message" => "Unauthorized access."
    ]);
    exit();
}

// === SECTION: INPUT HANDLING ===
$inputData = $_SERVER['REQUEST_METHOD'] === 'POST' 
    ? json_decode(file_get_contents("php://input"), true) 
    : $_GET;

$service_id = isset($inputData['service_id']) ? (int)$inputData['service_id'] : null;
$service_name = isset($inputData['service_name']) ? trim($inputData['service_name']) : null;

if (empty($service_id) && empty($service_name)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. service_id or service_name is required."
    ]);
    exit();
}

try {
    // Check if there are future active bookings for this service
    $query = "SELECT COUNT(*) as booking_count 
              FROM Booking b
              JOIN Service s ON b.service_id = s.service_id
              WHERE (s.service_id = :service_id OR s.service_name = :service_name)
                AND b.scheduled_date >= CURRENT_DATE()
                AND b.booking_status NOT IN ('Cancelled', 'No-Show')";
                
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':service_id', $service_id, $service_id ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(':service_name', $service_name, $service_name ? PDO::PARAM_STR : PDO::PARAM_NULL);
    $stmt->execute();
    $result = $stmt->fetch();

    $booking_count = (int)$result['booking_count'];
    $has_bookings = $booking_count > 0;

    echo json_encode([
        "status" => "success",
        "has_bookings" => $has_bookings,
        "booking_count" => $booking_count,
        "message" => $has_bookings 
            ? "Warning: There are active future bookings associated with this service." 
            : "No active future bookings found for this service."
    ]);

} catch (PDOException $e) {
    error_log("Check service bookings failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while validating service bookings."
    ]);
}
?>
