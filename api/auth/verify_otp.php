<?php
/**
 * File: api/auth/verify_otp.php
 * Purpose: Verifies the 6-digit OTP code inputted by the user.
 *          Supports both 'registration' and 'guest' types.
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

$email = isset($_POST['email']) ? trim($_POST['email']) : null;
$code = isset($_POST['code']) ? trim($_POST['code']) : null;
$type = isset($_POST['type']) ? trim($_POST['type']) : 'registration';

if (empty($email) || empty($code)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Email and verification code are required."]);
    exit();
}

// Attempt rate limiting / brute-forcing protection
$attempts_key = ($type === 'guest') ? 'guest_otp_attempts' : 'email_otp_attempts';
if (!isset($_SESSION[$attempts_key])) {
    $_SESSION[$attempts_key] = 0;
}
$_SESSION[$attempts_key]++;

if ($_SESSION[$attempts_key] > 5) {
    // Clear all OTP variables for this type to block brute forcing
    if ($type === 'guest') {
        unset($_SESSION['guest_otp']);
        unset($_SESSION['guest_otp_target']);
        unset($_SESSION['guest_otp_expires']);
        unset($_SESSION['guest_otp_verified']);
    } else {
        unset($_SESSION['email_otp']);
        unset($_SESSION['email_otp_target']);
        unset($_SESSION['email_otp_expires']);
        unset($_SESSION['email_otp_verified']);
    }
    unset($_SESSION[$attempts_key]);
    
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Too many incorrect verification attempts. Please request a new code."]);
    exit();
}


if ($type === 'guest') {
    if (!isset($_SESSION['guest_otp']) || !isset($_SESSION['guest_otp_target']) || !isset($_SESSION['guest_otp_expires'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "No verification session found. Please send code first."]);
        exit();
    }

    if (time() > $_SESSION['guest_otp_expires']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Verification code has expired. Please request a new one."]);
        exit();
    }

    if (strtolower($email) !== $_SESSION['guest_otp_target']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Email address mismatch."]);
        exit();
    }

    if ($code !== $_SESSION['guest_otp']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Incorrect verification code. Please try again."]);
        exit();
    }

    // Mark as verified in session
    $_SESSION['guest_otp_verified'] = true;
} else {
    if (!isset($_SESSION['email_otp']) || !isset($_SESSION['email_otp_target']) || !isset($_SESSION['email_otp_expires'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "No verification session found. Please send code first."]);
        exit();
    }

    if (time() > $_SESSION['email_otp_expires']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Verification code has expired. Please request a new one."]);
        exit();
    }

    if (strtolower($email) !== $_SESSION['email_otp_target']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Email address mismatch."]);
        exit();
    }

    if ($code !== $_SESSION['email_otp']) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Incorrect verification code. Please try again."]);
        exit();
    }

    // Mark as verified in session
    $_SESSION['email_otp_verified'] = true;
}

echo json_encode(["status" => "success", "message" => "Email verified successfully."]);
?>
