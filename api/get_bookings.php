<?php
/**
 * Get Bookings Endpoint
 * 
 * Executes a relational JOIN query to merge bookings with their corresponding 
 * Customer and Service details, allowing administrative tools to render 
 * human-readable customer names and service names rather than raw ID integers.
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
    // Perform a relational JOIN query to fetch enriched booking information
    $query = "SELECT b.booking_id, b.time_slot, b.scheduled_date, b.booking_status, s.service_name, c.full_name 
              FROM Booking b 
              JOIN Service s ON b.service_id = s.service_id 
              JOIN Customer c ON b.customer_id = c.customer_id 
              ORDER BY b.scheduled_date DESC, b.time_slot ASC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    // Fetch structured records
    $bookings = $stmt->fetchAll();
    
    // Return structured rows directly as a JSON array
    echo json_encode($bookings);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching booking data from the database.",
        "error" => $e->getMessage()
    ]);
}
