<?php
/**
 * File: api/services/delete_service.php
 * Purpose: Allows administrators to delete a detailing service package from the catalog database.
 * Input Params: JSON body (service_id)
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - The service package must exist.
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

try {
    // Require admin privilege
    require_auth('Admin');
    verify_csrf_request();

    $inputData = json_decode(file_get_contents("php://input"), true);

    $service_id = isset($inputData['service_id']) ? (int)$inputData['service_id'] : null;

    if (empty($service_id)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Incomplete request. Service ID is required."
        ]);
        exit();
    }

    // Check if the service has existing bookings that are pending/confirmed
    $checkQuery = "SELECT COUNT(*) as count FROM Booking WHERE service_id = :service_id AND booking_status NOT IN ('Cancelled', 'No-Show', 'Completed')";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $checkStmt->execute();
    $result = $checkStmt->fetch();

    if ($result && (int)$result['count'] > 0) {
        http_response_code(409); // Conflict
        echo json_encode([
            "status" => "error",
            "message" => "Cannot delete service. There are active bookings registered for this service package."
        ]);
        exit();
    }

    $query = "UPDATE Service SET is_active = 0 WHERE service_id = :service_id";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);

    if ($stmt->execute()) {
        log_system_event($conn, 'Service Deactivated', "Service ID {$service_id} deactivated (soft-deleted) by Admin.");
        
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "message" => "Service deactivated successfully!"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to deactivate service in database."
        ]);
    }

} catch (Exception $e) {
    error_log("Failed to delete service: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while deleting the service: " . $e->getMessage()
    ]);
}
?>
