<?php
/**
 * Database Configuration and Connection Script
 * 
 * Establishes a secure PDO connection to the MySQL database "montage_carwash_db".
 * Sets appropriate CORS (Cross-Origin Resource Sharing) headers to allow seamless
 * communication with decoupled frontend applications, and configures PDO to use
 * safe UTF-8 encoding and throw exceptions on error.
 */

// Establish CORS and JSON response headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS request gracefully for cross-origin requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Connection Credentials
$host = "localhost";
$db_name = "montage_carwash_db";
$username = "root";
$password = "";
$conn = null;

try {
    // Establish connection using PDO with forced UTF-8 (utf8mb4) encoding
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8mb4", $username, $password);
    
    // Configure PDO attributes
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $exception) {
    // Respond with a clean 500 server error JSON if the database connection fails
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed. Please ensure the database server is running and configured correctly.",
        "error" => $exception->getMessage()
    ]);
    exit();
}
