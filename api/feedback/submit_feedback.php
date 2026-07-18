<?php
/**
 * File: api/feedback/submit_feedback.php
 * Purpose: Inserts a new customer rating and feedback comment for a completed detailing session.
 * Input Params: JSON body (name, booking_id, service, rating, comments)
 * Validation rules:
 *   - Fields must not be empty.
 *   - The feedback comment length must be less than or equal to 1000 characters.
 *   - The rating must be an integer between 1 and 5.
 * Output: JSON response indicating success or specific validation error.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once __DIR__ . '/../config.php';

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

$booking_id_raw = isset($inputData['booking_id']) ? trim((string)$inputData['booking_id']) : null;
$rating = isset($inputData['rating']) ? $inputData['rating'] : null;
$comments = isset($inputData['comments']) ? trim($inputData['comments']) : null;
$client_name = isset($inputData['name']) ? trim((string)$inputData['name']) : '';
$service_name = isset($inputData['service']) ? trim((string)$inputData['service']) : '';

// === SECTION: INPUT VALIDATION ===
if ($rating === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. rating is a required field."
    ]);
    exit();
}

if ($comments !== null && strlen($comments) > 1000) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Comments must not exceed 1000 characters."
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

if ($client_name === '') {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Name is required."
    ]);
    exit();
}

if ($service_name === '') {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Service is required."
    ]);
    exit();
}

// Clean up MTG- prefix if present in booking_id
if (is_string($booking_id_raw) && $booking_id_raw !== '') {
    $booking_id_raw = str_replace('MTG-', '', $booking_id_raw);
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    $booking_id = null;
    $customer_id = null;

    if (empty($booking_id_raw)) {
        if (isset($_SESSION['role']) && $_SESSION['role'] === 'Subscriber' && isset($_SESSION['user_id'])) {
            // Find the latest completed booking for this customer to automatically associate the feedback
            $findBookingQuery = "SELECT booking_id, customer_id FROM Booking WHERE user_id = :user_id AND booking_status = 'Completed' ORDER BY scheduled_date DESC, time_slot DESC LIMIT 1";
            $findBookingStmt = $conn->prepare($findBookingQuery);
            $findBookingStmt->bindValue(':user_id', $_SESSION['user_id'], PDO::PARAM_INT);
            $findBookingStmt->execute();
            $booking = $findBookingStmt->fetch();
            if ($booking) {
                $booking_id = (int)$booking['booking_id'];
                $customer_id = (int)$booking['customer_id'];
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "message" => "You don't have any bookings to leave feedback for."
                ]);
                exit();
            }
        } else {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Booking ID is required to leave feedback."
            ]);
            exit();
        }
    } else {
        if (!filter_var($booking_id_raw, FILTER_VALIDATE_INT)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Invalid booking_id format. It must be an integer."
            ]);
            exit();
        }
        $booking_id = (int)$booking_id_raw;

        // Verify that the booking exists, is completed, and get customer_id
        $bookingCheckQuery = "SELECT customer_id, user_id, booking_status FROM Booking WHERE booking_id = :booking_id LIMIT 1";
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

        if ($booking['booking_status'] !== 'Completed') {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "You can only submit feedback for completed bookings."
            ]);
            exit();
        }

        $customer_id = (int)$booking['customer_id'];

        // If Subscriber, ensure the booking belongs to them
        if (isset($_SESSION['role']) && $_SESSION['role'] === 'Subscriber' && isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] !== (int)$booking['user_id']) {
            http_response_code(403);
            echo json_encode([
                "status" => "error",
                "message" => "Forbidden. You can only submit feedback for your own bookings."
            ]);
            exit();
        }
    }

    // Check if feedback has already been submitted for this booking
    if ($booking_id !== null) {
        $feedbackCheckQuery = "SELECT feedback_id FROM Feedback WHERE booking_id = :booking_id LIMIT 1";
        $feedbackCheckStmt = $conn->prepare($feedbackCheckQuery);
        $feedbackCheckStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
        $feedbackCheckStmt->execute();
        if ($feedbackCheckStmt->fetch()) {
            http_response_code(409); // Conflict
            echo json_encode([
                "status" => "error",
                "message" => "You've already submitted your feedback for this booking."
            ]);
            exit();
        }
    }

    // Insert feedback into Feedback table
    $insertQuery = "INSERT INTO Feedback (booking_id, rating, comments) 
                    VALUES (:booking_id, :rating, :comments)";
    $insertStmt = $conn->prepare($insertQuery);
    $insertStmt->bindValue(':booking_id', $booking_id, $booking_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $insertStmt->bindValue(':rating', $rating, PDO::PARAM_INT);
    $insertStmt->bindValue(':comments', $comments, PDO::PARAM_STR);
    $insertStmt->execute();

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
