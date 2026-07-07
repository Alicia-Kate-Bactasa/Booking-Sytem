<?php
/**
 * User Login Endpoint
 * 
 * Authenticates users for the decoupled application. Handles credentials
 * sequentially by first checking the Admin table (by username or email) and
 * then checking the Subscriber table (by email). Supports both hashed passwords
 * (production standard) and raw password checks (development fallback).
 * 
 * Returns status, role (Admin/Subscriber), respective identifier key
 * (admin_id or customer_id), and a success message on successful login.
 */

// Include database configuration and CORS headers
require_once __DIR__ . '/config.php';

// Validate HTTP request method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

// Read raw body input and decode JSON payload
$inputData = json_decode(file_get_contents("php://input"), true);

// Verify JSON payload was successfully parsed
if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

// Extracted variables supporting flexible incoming key namings
$login_input = null;
if (!empty($inputData['username_or_email'])) {
    $login_input = trim($inputData['username_or_email']);
} elseif (!empty($inputData['username'])) {
    $login_input = trim($inputData['username']);
} elseif (!empty($inputData['email'])) {
    $login_input = trim($inputData['email']);
}

$password = isset($inputData['password']) ? $inputData['password'] : null;

// Validate mandatory parameters
if (empty($login_input) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Username/Email and Password are required."
    ]);
    exit();
}

try {
    // ------------------------------------------------------------------
    // STEP 1: Check Admin Table
    // ------------------------------------------------------------------
    $adminQuery = "SELECT admin_id, username, email, password 
                   FROM Admin 
                   WHERE username = :username OR email = :email 
                   LIMIT 1";
                   
    $adminStmt = $conn->prepare($adminQuery);
    $adminStmt->bindValue(':username', $login_input, PDO::PARAM_STR);
    $adminStmt->bindValue(':email', $login_input, PDO::PARAM_STR);
    $adminStmt->execute();
    $admin = $adminStmt->fetch();

    if ($admin) {
        // Authenticate strictly using secure password_verify hashes
        if (password_verify($password, $admin['password'])) {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$admin['admin_id'];
            $_SESSION['role'] = 'Admin';
            $_SESSION['username'] = $admin['username'];
            $_SESSION['email'] = $admin['email'];

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "role" => "Admin",
                "admin_id" => (int)$admin['admin_id'],
                "message" => "Admin authorization successful!"
            ]);
            exit();
        }
    }

    // ------------------------------------------------------------------
    // STEP 2: Check Subscriber Table
    // ------------------------------------------------------------------
    $subQuery = "SELECT s.subscriber_id, s.customer_id, s.email, s.password, c.full_name 
                 FROM Subscriber s
                 JOIN Customer c ON s.customer_id = c.customer_id
                 WHERE s.email = :email 
                 LIMIT 1";
                 
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':email', $login_input, PDO::PARAM_STR);
    $subStmt->execute();
    $subscriber = $subStmt->fetch();

    if ($subscriber) {
        // Authenticate strictly using secure password_verify hashes
        if (password_verify($password, $subscriber['password'])) {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$subscriber['subscriber_id'];
            $_SESSION['role'] = 'Subscriber';
            $_SESSION['customer_id'] = (int)$subscriber['customer_id'];
            $_SESSION['email'] = $subscriber['email'];
            $_SESSION['name'] = $subscriber['full_name'];

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "role" => "Subscriber",
                "customer_id" => (int)$subscriber['customer_id'],
                "subscriber_id" => (int)$subscriber['subscriber_id'],
                "full_name" => $subscriber['full_name'],
                "message" => "Subscriber authorization successful!"
            ]);
            exit();
        }
    }

    // If no credentials match
    http_response_code(401);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid credentials. Please verify your email/username and password."
    ]);

} catch (PDOException $e) {
    error_log("Authentication failure: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred during authentication."
    ]);
}
