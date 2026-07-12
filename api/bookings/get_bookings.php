<?php
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
    // Allow both Admin and Subscriber users to retrieve booking list
    require_auth(['Admin', 'Subscriber']);

    $query = "SELECT b.booking_id, b.time_slot, b.scheduled_date, b.booking_status, b.bay_number, b.purchased_price, s.service_name, c.full_name, c.customer_type 
              FROM Booking b 
              JOIN Service s ON b.service_id = s.service_id 
              JOIN Customer c ON b.customer_id = c.customer_id";

    // If the authenticated user is a Subscriber, filter to return only their own bookings
    if ($_SESSION['role'] === 'Subscriber') {
        $query .= " WHERE c.customer_id = :customer_id";
    }

    $query .= " ORDER BY b.scheduled_date DESC, b.time_slot ASC";
              
    $stmt = $conn->prepare($query);

    if ($_SESSION['role'] === 'Subscriber') {
        $stmt->bindValue(':customer_id', $_SESSION['customer_id'], PDO::PARAM_INT);
    }

    $stmt->execute();
    
    // Fetch structured records
    $bookings = $stmt->fetchAll();
    
    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $bookings
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to fetch bookings: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching booking data from the database."
    ]);
}
?>
