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

$booking_id_raw = isset($inputData['booking_id']) ? $inputData['booking_id'] : null;
$rating = isset($inputData['rating']) ? $inputData['rating'] : null;
$comments = isset($inputData['comments']) ? trim($inputData['comments']) : null;

// === SECTION: INPUT VALIDATION ===
if ($rating === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. rating is a required field."
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

// Clean up MTG- prefix if present in booking_id
if (is_string($booking_id_raw)) {
    $booking_id_raw = str_replace('MTG-', '', $booking_id_raw);
}

// === SECTION: TRANSACTION & DATABASE OPERATION ===
try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);

    $booking_id = null;
    $customer_id = null;

    if (empty($booking_id_raw)) {
        if ($_SESSION['role'] === 'Subscriber') {
            // Find the latest completed booking for this customer to automatically associate the feedback
            $findBookingQuery = "SELECT booking_id, customer_id FROM Booking WHERE customer_id = :customer_id AND booking_status = 'Completed' ORDER BY scheduled_date DESC, time_slot DESC LIMIT 1";
            $findBookingStmt = $conn->prepare($findBookingQuery);
            $findBookingStmt->bindValue(':customer_id', $_SESSION['customer_id'], PDO::PARAM_INT);
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
                "message" => "booking_id is required."
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
        $bookingCheckQuery = "SELECT customer_id, booking_status FROM Booking WHERE booking_id = :booking_id LIMIT 1";
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
        if ($_SESSION['role'] === 'Subscriber' && (int)$_SESSION['customer_id'] !== $customer_id) {
            http_response_code(403);
            echo json_encode([
                "status" => "error",
                "message" => "Forbidden. You can only submit feedback for your own bookings."
            ]);
            exit();
        }
    }

    // Insert feedback into Feedback table
    $insertQuery = "INSERT INTO Feedback (booking_id, customer_id, rating, comments) 
                    VALUES (:booking_id, :customer_id, :rating, :comments)";
    $insertStmt = $conn->prepare($insertQuery);
    $insertStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
    $insertStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
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
