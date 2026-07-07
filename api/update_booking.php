<?php
/**
 * Update Booking Status Endpoint
 * 
 * Modifies the booking_status column of a specific booking record.
 * Validates the status against the defined database enum values to ensure integrity.
 */

// Include database configuration and CORS headers
require_once __DIR__ . '/config.php';

// Validate HTTP request method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

// Read raw body input and decode JSON payload
$inputData = json_decode(file_get_contents("php://input"), true);

// Verify JSON payload was successfully parsed
if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

// Extracted variables
$booking_id = isset($inputData['booking_id']) ? $inputData['booking_id'] : null;
$booking_status = isset($inputData['booking_status']) ? trim($inputData['booking_status']) : (isset($inputData['status']) ? trim($inputData['status']) : null);

// Validate mandatory parameters
if (empty($booking_id) || empty($booking_status)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id and booking_status are required fields."
    ]);
    exit();
}

// Validate booking status matches MySQL Schema ENUM constraints
$validStatuses = ['Pending Verification', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'];
if (!in_array($booking_status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid booking status. Allowed values are: " . implode(", ", $validStatuses)
    ]);
    exit();
}

try {
    // Only allow verified Admin users to update booking statuses
    require_auth('Admin');

    // Check if the booking actually exists before updating
    $checkQuery = "SELECT booking_id FROM Booking WHERE booking_id = :booking_id";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->execute([':booking_id' => $booking_id]);
    
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Booking record not found with ID " . htmlspecialchars($booking_id)
        ]);
        exit();
    }

    // Prepare and execute update
    $query = "UPDATE Booking SET booking_status = :booking_status WHERE booking_id = :booking_id";
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    $stmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "message" => "Booking status updated successfully!"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to update booking status. Database transaction failed."
        ]);
    }
} catch (PDOException $e) {
    error_log("Failed to update booking status: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while trying to update booking status."
    ]);
}
