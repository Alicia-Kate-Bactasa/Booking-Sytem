<?php
/**
 * Submit Feedback Endpoint
 * 
 * Records post-visit customer satisfaction evaluations. Linked 1:1 to a Booking ID
 * to prevent duplicate reviews (enforced by the unique constraint on booking_id).
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
$rating = isset($inputData['rating']) ? $inputData['rating'] : null;
$comments = isset($inputData['comments']) ? trim($inputData['comments']) : null;

// Validate mandatory parameters
if (empty($booking_id) || $rating === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. booking_id and rating are required fields."
    ]);
    exit();
}

// Validate formats
if (!filter_var($booking_id, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid booking_id format. It must be an integer."
    ]);
    exit();
}

// Validate rating scale (Between 1 and 5)
if (!filter_var($rating, FILTER_VALIDATE_INT) || $rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid rating value. Rating must be an integer between 1 and 5."
    ]);
    exit();
}

try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);

    // Check if the referenced booking exists and retrieve its customer_id
    $bookingCheckQuery = "SELECT booking_id, customer_id FROM Booking WHERE booking_id = :booking_id";
    $bookingCheckStmt = $conn->prepare($bookingCheckQuery);
    $bookingCheckStmt->execute([':booking_id' => $booking_id]);
    $booking = $bookingCheckStmt->fetch();
    
    if (!$booking) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Referenced Booking ID does not exist in the database."
        ]);
        exit();
    }

    // If the authenticated user is a Subscriber, check that they own this booking
    if ($_SESSION['role'] === 'Subscriber' && (int)$booking['customer_id'] !== $_SESSION['customer_id']) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Forbidden. You are not authorized to submit feedback for this booking."
        ]);
        exit();
    }

    // Insert prepared statement for Feedback
    $query = "INSERT INTO Feedback (booking_id, rating, comments) 
              VALUES (:booking_id, :rating, :comments)";
              
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $stmt->bindValue(':rating', $rating, PDO::PARAM_INT);
    $stmt->bindValue(':comments', $comments, empty($comments) ? PDO::PARAM_NULL : PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "message" => "Feedback successfully submitted! Thank you for your review."
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to submit feedback. Database transaction failed."
        ]);
    }
} catch (PDOException $e) {
    // Catch standard MySQL duplicate entry errors (SQLSTATE code 23000)
    if ($e->getCode() == 23000) {
        http_response_code(409); // Conflict
        echo json_encode([
            "status" => "error",
            "message" => "Feedback has already been submitted for this booking. You can only leave one review per session."
        ]);
    } else {
        error_log("Failed to submit feedback: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "An error occurred while trying to record feedback."
        ]);
    }
}
