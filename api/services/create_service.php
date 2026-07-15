<?php
/**
 * File: api/services/create_service.php
 * Purpose: Allows administrators to register a new vehicle detailing service package in the catalog.
 * Input Params: JSON body (name, description, duration_minutes, service_price)
 * Validation rules:
 *   - User must be logged in as an Admin.
 *   - The name, description, duration, and price are required.
 *   - Duration must be a positive integer greater than or equal to 1 minute.
 *   - Service price must be a non-negative decimal greater than or equal to ₱0.00.
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

    $name = isset($inputData['name']) ? trim($inputData['name']) : null;
    $desc = isset($inputData['desc']) ? trim($inputData['desc']) : '';
    $duration = isset($inputData['duration']) ? (int)$inputData['duration'] : null;
    $price = isset($inputData['price']) ? (float)$inputData['price'] : null;
    $category = isset($inputData['category']) ? trim($inputData['category']) : 'Detailing';

    if (empty($name) || empty($duration) || empty($price)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Incomplete request. Name, duration, and price are required."
        ]);
        exit();
    }

    if ($price < 0) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Price cannot be negative."
        ]);
        exit();
    }

    if ($duration < 1) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Duration must be at least 1 minute."
        ]);
        exit();
    }

    $query = "INSERT INTO Service (service_name, service_description, service_duration, service_price, service_category) 
              VALUES (:name, :desc, :duration, :price, :category)";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':name', $name, PDO::PARAM_STR);
    $stmt->bindValue(':desc', $desc, PDO::PARAM_STR);
    $stmt->bindValue(':duration', $duration, PDO::PARAM_INT);
    $stmt->bindValue(':price', $price, PDO::PARAM_STR);
    $stmt->bindValue(':category', $category, PDO::PARAM_STR);

    if ($stmt->execute()) {
        $service_id = (int)$conn->lastInsertId();
        log_system_event($conn, 'Service Created', "Service ID {$service_id} ({$name}) created by Admin.");
        
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "data" => [
                "message" => "Service created successfully!",
                "service_id" => $service_id,
                "name" => $name,
                "price" => $price,
                "duration" => $duration,
                "desc" => $desc
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to create service in database."
        ]);
    }

} catch (Exception $e) {
    error_log("Failed to create service: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while creating the service: " . $e->getMessage()
    ]);
}
?>
