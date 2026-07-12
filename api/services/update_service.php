<?php
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
    $name = isset($inputData['name']) ? trim($inputData['name']) : null;
    $desc = isset($inputData['desc']) ? trim($inputData['desc']) : '';
    $duration = isset($inputData['duration']) ? (int)$inputData['duration'] : null;
    $price = isset($inputData['price']) ? (float)$inputData['price'] : null;
    $category = isset($inputData['category']) ? trim($inputData['category']) : 'Detailing';

    if (empty($service_id) || empty($name) || empty($duration) || empty($price)) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Incomplete request. Service ID, name, duration, and price are required."
        ]);
        exit();
    }

    $query = "UPDATE Service 
              SET service_name = :name, service_description = :desc, service_duration = :duration, service_price = :price, service_category = :category 
              WHERE service_id = :service_id";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':name', $name, PDO::PARAM_STR);
    $stmt->bindValue(':desc', $desc, PDO::PARAM_STR);
    $stmt->bindValue(':duration', $duration, PDO::PARAM_INT);
    $stmt->bindValue(':price', $price, PDO::PARAM_STR);
    $stmt->bindValue(':category', $category, PDO::PARAM_STR);
    $stmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);

    if ($stmt->execute()) {
        log_system_event($conn, 'Service Updated', "Service ID {$service_id} updated by Admin.");
        
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "message" => "Service updated successfully!"
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to update service in database."
        ]);
    }

} catch (Exception $e) {
    error_log("Failed to update service: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while updating the service: " . $e->getMessage()
    ]);
}
?>
