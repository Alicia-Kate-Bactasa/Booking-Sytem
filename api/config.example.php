<?php
/**
 * Database Configuration Template (Safe for GitHub Version Control)
 * * Instructions:
 * 1. Copy this template file and rename the copy to 'config.php'.
 * 2. Keep 'config.php' untracked by Git via your .gitignore settings.
 * 3. Provide your environment credentials below.
 */

// Establish CORS and JSON response headers supporting credentials
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS requests gracefully
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Secure session configuration and initialization
if (session_status() === PHP_SESSION_NONE && isset($_SERVER['REQUEST_METHOD'])) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        ini_set('session.cookie_secure', 1);
    }
    session_start();
}

/**
 * Enforces role-based authentication check blocks.
 * @param string|array $allowedRoles Roles permitted to access the resource
 */
function require_auth($allowedRoles) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Unauthorized. Please log in first."
        ]);
        exit();
    }
    
    $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
    if (!in_array($_SESSION['role'], $roles, true)) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Forbidden. You do not have permission to access this resource."
        ]);
        exit();
    }
}

// =========================================================================
// ENVIRONMENT DATABASE BOUNDARY SETTINGS (Fill locally; do not push)
// =========================================================================
$host = "localhost";
$db_name = "YOUR_DATABASE_NAME_HERE"; // e.g., s22104079_montageAutoStudio
$username = "YOUR_USERNAME_HERE";      // Identical to DB name on DCISM live server
$password = "YOUR_PASSWORD_HERE";      // Your live database panel password secret
$conn = null;

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $exception) {
    error_log("Database connection failed: " . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection offline. Verify local environment credentials."
    ]);
    exit();
}