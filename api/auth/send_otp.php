<?php
/**
 * File: api/auth/send_otp.php
 * Purpose: Generates a 6-digit verification code and emails it to the user.
 *          Saves the code and timestamp in session for verification.
 *          Supports both 'registration' and 'guest' types.
 */

header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';
require_once '../utils/mailer.php';

$email = isset($_POST['email']) ? trim($_POST['email']) : null;
$type = isset($_POST['type']) ? trim($_POST['type']) : 'registration';

if (empty($email)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Email is required."]);
    exit();
}

$email_err = validate_email_active($email);
if ($email_err !== true) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => $email_err]);
    exit();
}

// Check if email already exists in User table (Only for registration type)
if ($type === 'registration') {
    try {
        $stmt = $conn->prepare("SELECT user_id FROM User WHERE email = :email LIMIT 1");
        $stmt->bindValue(':email', $email, PDO::PARAM_STR);
        $stmt->execute();
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "An account with this email address already exists. Please log in."]);
            exit();
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Database check failed."]);
        exit();
    }
}

// Generate 6-digit OTP
$otp = strval(rand(100000, 999999));

// Store in session according to type
if ($type === 'guest') {
    $_SESSION['guest_otp'] = $otp;
    $_SESSION['guest_otp_target'] = strtolower($email);
    $_SESSION['guest_otp_expires'] = time() + 300; // 5 minutes expiration
    $_SESSION['guest_otp_verified'] = false;
    $_SESSION['guest_otp_attempts'] = 0; // Reset attempts for new code
} else {
    $_SESSION['email_otp'] = $otp;
    $_SESSION['email_otp_target'] = strtolower($email);
    $_SESSION['email_otp_expires'] = time() + 300; // 5 minutes expiration
    $_SESSION['email_otp_verified'] = false;
    $_SESSION['email_otp_attempts'] = 0; // Reset attempts for new code
}

// Format email HTML body
$htmlContent = "
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
    <h2 style='color: #111; text-align: center; text-transform: uppercase; letter-spacing: 1px;'>Montage Auto Studio</h2>
    <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>
    <p>Hello,</p>
    <p>Thank you for choosing Montage Auto Studio. To complete your verification, please use the 6-digit code below:</p>
    <div style='background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;'>
        <span style='font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #111;'>{$otp}</span>
    </div>
    <p style='color: #666; font-size: 12px;'>This code is valid for the next 5 minutes. If you did not initiate this request, you can safely ignore this email.</p>
    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
    <p style='font-size: 11px; color: #888; text-align: center; margin: 0;'>
        Montage Auto Studio Team
    </p>
</div>
";

$subject = "Verification Code - Montage Auto Studio";
if (Mailer::send($email, $subject, $htmlContent)) {
    echo json_encode(["status" => "success", "message" => "Verification code sent to your email."]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to send verification email. Please try again."]);
}
?>
