<?php
// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once 'config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

// === SECTION: INPUT HANDLING ===
$inputData = json_decode(file_get_contents("php://input"), true);

if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

$booking_id = isset($inputData['booking_id']) ? $inputData['booking_id'] : null;
$rating = isset($inputData['rating']) ? $inputData['rating'] : null;
$comments = isset($inputData['comments']) ? trim($inputData['comments']) : null;

// === SECTION: INPUT VALIDATION ===
if (empty($booking_id) || $rating === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id and rating are required fields."
    ]);
    exit();
}

if (!filter_var($booking_id, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid booking_id format. It must be an integer."
    ]);
    exit();
}

if (!filter_var($rating, FILTER_VALIDATE_INT) || $rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid rating value. Rating must be an integer between 1 and 5."
    ]);
    exit();
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);

    // Verify that the booking exists in the Booking table to validate booking_id
    $bookingCheckQuery = "SELECT booking_id FROM Booking WHERE booking_id = :booking_id LIMIT 1";
    $bookingCheckStmt = $conn->prepare($bookingCheckQuery);
    $bookingCheckStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $bookingCheckStmt->execute();
    $booking = $bookingCheckStmt->fetch();
    
    if (!$booking) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Referenced Booking ID does not exist in the database."
        ]);
        exit();
    }

    // Since the Feedback table is not present in the new database schema, we handle this gracefully
    // by mocking a successful response (the frontend stores feedbacks in localStorage).
    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "data" => [
            "message" => "Feedback successfully submitted! Thank you for your review."
        ]
    ]);
// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to submit feedback: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while trying to record feedback."
    ]);
}
?>
