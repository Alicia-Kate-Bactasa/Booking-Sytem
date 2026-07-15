<?php
/**
 * File: api/auth/check_email.php
 * Purpose: A public endpoint query to check if a subscriber's email is already registered in the User table database.
 *          Used dynamically on the frontend wizard step 1 to prevent progressing with duplicates.
 * Input Params: GET parameter (email)
 * Output: JSON response returning {"status": "success", "exists": true|false}
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

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid email format."
    ]);
    exit();
}

try {
    $stmt = $conn->prepare("SELECT user_id FROM User WHERE email = :email LIMIT 1");
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $exists = (bool)$stmt->fetch();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "exists" => $exists
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
