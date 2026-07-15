<?php
/**
 * File: api/services/get_services.php
 * Purpose: Public endpoint to fetch all registered detailing service packages from the catalog database.
 *          Maps descriptions, duration estimates, prices, and names.
 * Input Params: GET request
 * Output: JSON response returning active detailing service packages list.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET requests are accepted."
    ]);
    exit();
}

// === SECTION: DATABASE QUERY & EXECUTION ===
try {
    // Prepare and execute database query matching the specified schema fields
    $query = "SELECT service_id, 
                     service_name, 
                     service_name AS name, 
                     service_price, 
                     service_price AS price, 
                     service_category,
                     CONCAT(service_duration, ' Mins') AS duration, 
                     service_duration, 
                     service_description AS `desc`, 
                     service_description AS description,
                     service_description 
              FROM Service 
              ORDER BY service_id ASC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    // Fetch all active service rows
    $services = $stmt->fetchAll();
    
    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $services
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to fetch services: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching service data from the database."
    ]);
}
?>
