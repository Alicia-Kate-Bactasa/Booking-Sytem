<?php
/**
 * File: api/feedback/get_feedbacks.php
 * Purpose: Retrieves all active customer rating and feedback comment records.
 * Input Params: GET request
 * Output: JSON response returning lists of feedback records (name, rating, comments, date).
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once __DIR__ . '/../config.php';

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
    // Require Admin authentication
    require_auth('Admin');

    $query = "SELECT 
                f.feedback_id,
                f.booking_id,
                f.rating,
                f.comments,
                f.created_at,
                c.customer_type AS feedback_type,
                COALESCE(c.full_name, 'Guest') AS client,
                COALESCE(s.service_name, 'N/A') AS service
              FROM Feedback f
              LEFT JOIN Booking b ON f.booking_id = b.booking_id
              LEFT JOIN Customer c ON b.customer_id = c.customer_id
              LEFT JOIN Service s ON b.service_id = s.service_id
              ORDER BY f.created_at DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    $feedbacks = $stmt->fetchAll();
    
    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $feedbacks
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to fetch feedbacks: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching feedback data."
    ]);
}
?>
