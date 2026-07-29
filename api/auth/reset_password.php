<?php
/**
 * File: api/auth/reset_password.php
 * Purpose: Verifies a reset token or verified OTP session and updates the user's password in the database.
 * Input Params: POST request (token OR email, new_password)
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
$email = isset($inputData['email']) ? trim($inputData['email']) : null;
$new_password = isset($inputData['new_password']) ? $inputData['new_password'] : null;

if ((empty($token) && empty($email)) || empty($new_password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Token or email, and new password are required fields."
    ]);
    exit();
}

if (strlen($new_password) < 8 || 
    !preg_match("/[A-Z]/", $new_password) || 
    !preg_match("/[a-z]/", $new_password) || 
    !preg_match("/[0-9]/", $new_password) || 
    !preg_match("/[^a-zA-Z0-9]/", $new_password)) {
    
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    ]);
    exit();
}

try {
    $conn->beginTransaction();

    if (!empty($token)) {
        // 1. Fetch token and check expiry from UserSecurityAction
        $tokenQuery = "SELECT identifier AS email, expires_at FROM UserSecurityAction WHERE action_type = 'password_reset' AND token = :token LIMIT 1";
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
            $cleanQuery = "DELETE FROM UserSecurityAction WHERE action_type = 'password_reset' AND token = :token";
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
    } else {
        // 2. Verify session OTP verification for email
        if (!isset($_SESSION['reset_otp_verified']) || $_SESSION['reset_otp_verified'] !== true ||
            !isset($_SESSION['reset_otp_target']) || $_SESSION['reset_otp_target'] !== strtolower($email)) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Security Violation: Email verification via OTP is required before resetting password."
            ]);
            exit();
        }
    }

    // 3. Hash new password
    $hashedPassword = password_hash($new_password, PASSWORD_BCRYPT);

    // 4. Update password in User table
    $updateQuery = "UPDATE User SET password = :password WHERE email = :email";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':password', $hashedPassword, PDO::PARAM_STR);
    $updateStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $updateStmt->execute();

    // 5. Clean up reset tokens and session variables
    if (!empty($token)) {
        $deleteQuery = "DELETE FROM UserSecurityAction WHERE action_type = 'password_reset' AND identifier = :email";
        $deleteStmt = $conn->prepare($deleteQuery);
        $deleteStmt->bindValue(':email', $email, PDO::PARAM_STR);
        $deleteStmt->execute();
    } else {
        unset($_SESSION['reset_otp']);
        unset($_SESSION['reset_otp_target']);
        unset($_SESSION['reset_otp_expires']);
        unset($_SESSION['reset_otp_verified']);
        unset($_SESSION['reset_otp_attempts']);
    }

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
