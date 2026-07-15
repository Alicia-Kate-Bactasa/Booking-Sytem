<?php
/**
 * File: api/auth/logout.php
 * Purpose: Securely destroys the current PHP session, clears cookies, and logs the user out.
 * Output: JSON response indicating successful logout.
 */
require_once '../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Clear all session variables
$_SESSION = array();

// Destroy the session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy session
session_destroy();

http_response_code(200);
echo json_encode([
    "status" => "success",
    "message" => "Logged out successfully"
]);
exit();
