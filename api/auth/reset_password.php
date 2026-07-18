<?php
/**
 * File: api/auth/reset_password.php
 * Purpose: Verifies a reset token and updates the user's password in the database.
 * Input Params: POST request (token, new_password)
 * Output: JSON response indicating success or specific validation error.
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

$inputData = json_decode(file_get_contents("php://input"), true);
$token = isset($inputData['token']) ? trim($inputData['token']) : null;
$new_password = isset($inputData['new_password']) ? $inputData['new_password'] : null;

if (empty($token) || empty($new_password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Token and new password are required fields."
    ]);
    exit();
}

if (strlen($new_password) < 6) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must be at least 6 characters long."
    ]);
    exit();
}

try {
    $conn->beginTransaction();

    // 1. Fetch token and check expiry
    $tokenQuery = "SELECT email, expires_at FROM PasswordReset WHERE token = :token LIMIT 1";
    $tokenStmt = $conn->prepare($tokenQuery);
    $tokenStmt->bindValue(':token', $token, PDO::PARAM_STR);
    $tokenStmt->execute();
    $resetReq = $tokenStmt->fetch();

    if (!$resetReq) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid or expired password reset token."
        ]);
        exit();
    }

    $today = date('Y-m-d H:i:s');
    if ($resetReq['expires_at'] < $today) {
        // Token has expired. Clean it up.
        $cleanQuery = "DELETE FROM PasswordReset WHERE token = :token";
        $cleanStmt = $conn->prepare($cleanQuery);
        $cleanStmt->bindValue(':token', $token, PDO::PARAM_STR);
        $cleanStmt->execute();
        
        $conn->commit();
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Your password reset token has expired. Please request a new one."
        ]);
        exit();
    }

    $email = $resetReq['email'];

    // 2. Hash new password
    $hashedPassword = password_hash($new_password, PASSWORD_BCRYPT);

    // 3. Update password in User table
    $updateQuery = "UPDATE User SET password = :password WHERE email = :email";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
    $updateStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $updateStmt->execute();

    // 4. Delete the token so it cannot be reused
    $deleteQuery = "DELETE FROM PasswordReset WHERE email = :email";
    $deleteStmt = $conn->prepare($deleteQuery);
    $deleteStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $deleteStmt->execute();

    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "Password successfully reset! You can now log in with your new password."
    ]);

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Failed to reset password: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while resetting the password."
    ]);
}
?>
