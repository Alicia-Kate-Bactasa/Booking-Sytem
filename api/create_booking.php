<?php
/**
 * Create Booking Endpoint
 * 
 * Intercepts JSON payloads from the frontend, validates all required attributes
 * (customer_id, service_id, scheduled_date, and time_slot), and securely inserts
 * a new booking record using parameterized SQL queries to prevent SQL injections.
 * Manually defaults the status string to 'Pending Verification'.
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
$customer_id = isset($inputData['customer_id']) ? $inputData['customer_id'] : null;
$service_id = isset($inputData['service_id']) ? $inputData['service_id'] : null;
$scheduled_date = isset($inputData['scheduled_date']) ? $inputData['scheduled_date'] : null;
$time_slot = isset($inputData['time_slot']) ? trim($inputData['time_slot']) : null;

// Validate mandatory parameters
if (empty($customer_id) || empty($service_id) || empty($scheduled_date) || empty($time_slot)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. customer_id, service_id, scheduled_date, and time_slot are required fields."
    ]);
    exit();
}

// Validate basic formats (optional helper checks)
if (!filter_var($customer_id, FILTER_VALIDATE_INT) || !filter_var($service_id, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid ID formatting. customer_id and service_id must be integers."
    ]);
    exit();
}

try {
    // Manually specify default booking status as requested
    $booking_status = 'Pending Verification';

    // Insert prepared statement with explicit parameter binding
    $query = "INSERT INTO Booking (customer_id, service_id, scheduled_date, time_slot, booking_status) 
              VALUES (:customer_id, :service_id, :scheduled_date, :time_slot, :booking_status)";
              
    $stmt = $conn->prepare($query);
    
    // Explicit parameter binding to block SQL injections
    $stmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $stmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $stmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $stmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $stmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    
    // Execute insert operation
    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "message" => "Booking successfully saved to database!"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to save booking. Database did not execute the operation."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while attempting to write booking to the database.",
        "error" => $e->getMessage()
    ]);
}
