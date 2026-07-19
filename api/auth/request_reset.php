<?php
/**
 * File: api/auth/request_reset.php
 * Purpose: Generates a secure temporary password reset token and sends it to the user's email.
 * Input Params: POST request (email)
 * Output: JSON response indicating link sent or user validation error.
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
$email = isset($inputData['email']) ? trim($inputData['email']) : null;

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
    // 1. Create UserSecurityAction table if it does not exist
    $conn->exec("CREATE TABLE IF NOT EXISTS UserSecurityAction (
        action_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        action_type ENUM('login_attempt','password_reset') NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        identifier VARCHAR(100) NOT NULL,
        token VARCHAR(64) DEFAULT NULL UNIQUE,
        expires_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_security_action_user FOREIGN KEY (user_id) REFERENCES User (user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Check if the user exists
    $userQuery = "SELECT user_id, email, username FROM User WHERE email = :email LIMIT 1";
    $userStmt = $conn->prepare($userQuery);
    $userStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $userStmt->execute();
    $user = $userStmt->fetch();

    if (!$user) {
        // For security, don't explicitly leak whether email exists. Show success.
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "message" => "If the email is registered, a password reset link has been sent."
        ]);
        exit();
    }

    // Check if a reset token was already requested in the last 60 seconds (rate limiting)
    $rateLimitQuery = "SELECT created_at FROM UserSecurityAction WHERE action_type = 'password_reset' AND identifier = :email LIMIT 1";
    $rateLimitStmt = $conn->prepare($rateLimitQuery);
    $rateLimitStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $rateLimitStmt->execute();
    $existingToken = $rateLimitStmt->fetch();
    if ($existingToken) {
        $createdTime = strtotime($existingToken['created_at']);
        if (time() - $createdTime < 60) {
            http_response_code(429); // Too Many Requests
            echo json_encode([
                "status" => "error",
                "message" => "Rate limit exceeded. Please wait at least 60 seconds before requesting another password reset link."
            ]);
            exit();
        }
    }

    // 3. Delete any existing reset tokens for this email to prevent multiple valid links
    $deleteQuery = "DELETE FROM UserSecurityAction WHERE action_type = 'password_reset' AND identifier = :email";
    $deleteStmt = $conn->prepare($deleteQuery);
    $deleteStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $deleteStmt->execute();

    // 4. Generate random token and expiration timestamp (1 hour)
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // 5. Insert token record
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '';
    $insertQuery = "INSERT INTO UserSecurityAction (user_id, action_type, ip_address, identifier, token, expires_at) 
                    VALUES (:user_id, 'password_reset', :ip_address, :email, :token, :expires_at)";
    $insertStmt = $conn->prepare($insertQuery);
    $insertStmt->bindValue(':user_id', (int)$user['user_id'], PDO::PARAM_INT);
    $insertStmt->bindValue(':ip_address', $ip_address, PDO::PARAM_STR);
    $insertStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $insertStmt->bindValue(':token', $token, PDO::PARAM_STR);
    $insertStmt->bindValue(':expires_at', $expiresAt, PDO::PARAM_STR);
    $insertStmt->execute();

    // 6. Construct reset URL dynamically
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $uri = $_SERVER['REQUEST_URI'];
    // Replaces 'api/auth/request_reset.php' with empty string to get project root
    $projectPath = str_replace('api/auth/request_reset.php', '', $uri);
    $resetLink = $protocol . "://" . $host . $projectPath . "reset_password.html?token=" . $token;

    // 7. Fetch customer full name if available (joining Customer)
    $nameQuery = "SELECT full_name FROM Customer WHERE email = :email LIMIT 1";
    $nameStmt = $conn->prepare($nameQuery);
    $nameStmt->bindValue(':email', $email, PDO::PARAM_STR);
    $nameStmt->execute();
    $customer = $nameStmt->fetch();
    $fullName = $customer ? $customer['full_name'] : $user['username'];

    require_once __DIR__ . '/../utils/mailer.php';
    $subject = "Reset Your Password - Montage Auto Studio";
    
    // Sleek HTML email notification template that fits branding without invoice structure
    $htmlContent = Mailer::formatNotification([
        'title' => 'Password Reset',
        'status_bg' => '#fcf8e3',
        'status_border' => '#f0ad4e',
        'status_color' => '#8a6d3b',
        'status_label' => 'Password Reset Requested',
        'status_detail' => "Hello {$fullName}, we received a request to reset the password associated with your account. Click the button below to set a new password. This link is valid for 1 hour.",
        'date' => date('Y-m-d'),
        'client_name' => $fullName,
        'button_html' => "<a href=\"{$resetLink}\" style=\"display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;\">Reset Password</a>"
    ]);

    Mailer::send($email, $subject, $htmlContent);

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "If the email is registered, a password reset link has been sent."
    ]);

} catch (Exception $e) {
    error_log("Failed to process request_reset.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while generating the reset request: " . $e->getMessage()
    ]);
}
?>
