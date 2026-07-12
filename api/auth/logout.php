<?php
/**
 * Logout Endpoint
 * 
 * Securely destroys the current session and clears session cookies,
 * logging the user out from the server-side.
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
