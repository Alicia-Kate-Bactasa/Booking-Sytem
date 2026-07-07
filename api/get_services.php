<?php
/**
 * Get Services Endpoint
 * 
 * Retrieves the catalog of active services from the database.
 * Filters by availability and returns them in ascending order of their IDs.
 */

// Include database configuration and CORS headers
require_once __DIR__ . '/config.php';

// Validate HTTP request method
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET requests are accepted."
    ]);
    exit();
}

try {
    // Prepare and execute database query matching the specified schema fields
    $query = "SELECT service_id, service_name, var_price, service_duration, service_description 
              FROM Service 
              WHERE is_available = 1 
              ORDER BY service_id ASC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    // Fetch all active service rows
    $services = $stmt->fetchAll();
    
    // Return the array directly as a JSON response
    echo json_encode($services);
} catch (PDOException $e) {
    error_log("Failed to fetch services: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching service data from the database."
    ]);
}
