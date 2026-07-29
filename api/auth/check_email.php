<?php
/**
 * File: api/auth/check_email.php
 * Purpose: A public endpoint query to check if an email is registered in User or Customer tables.
 *          Returns subscriber existence as well as guest booking_count and discount eligibility.
 * Input Params: GET parameter (email)
 * Output: JSON response with exists, booking_count, discount_eligible
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

$email = isset($_GET['email']) ? trim($_GET['email']) : null;

if (empty($email)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Email is required."
    ]);
    exit();
}

$email_err = validate_email_active($email);
if ($email_err !== true) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => $email_err
    ]);
    exit();
}

try {
    // 1. Check User table for registered subscribers
    $stmt = $conn->prepare("SELECT u.user_id, u.role, s.plan_status 
                            FROM User u 
                            LEFT JOIN Subscription s ON u.user_id = s.user_id 
                            WHERE u.email = :email LIMIT 1");
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch();

    $exists = $user ? true : false;

    // 2. Ensure booking_count column exists on Customer table
    try {
        $checkCol = $conn->query("SHOW COLUMNS FROM Customer LIKE 'booking_count'");
        if ($checkCol->rowCount() == 0) {
            $conn->exec("ALTER TABLE Customer ADD COLUMN booking_count INT DEFAULT 0");
        }
    } catch (Exception $e) {
        // Suppress column check errors if column already exists
    }

    // 3. Query Customer table for guest booking count
    $custStmt = $conn->prepare("SELECT customer_id, full_name, booking_count FROM Customer WHERE email = :email LIMIT 1");
    $custStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $custStmt->execute();
    $cust = $custStmt->fetch();

    $booking_count = $cust ? (int)($cust['booking_count'] ?? 0) : 0;
    $discount_eligible = ($booking_count >= 3);

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "exists" => $exists,
        "is_guest" => $cust ? true : false,
        "booking_count" => $booking_count,
        "discount_eligible" => $discount_eligible,
        "discount_percent" => $discount_eligible ? 10 : 0
    ]);
} catch (PDOException $e) {
    error_log("Check email query failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed."
    ]);
}
?>
