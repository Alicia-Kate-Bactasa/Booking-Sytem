<?php
/**
 * File: api/auth/login.php
 * Purpose: Processes user portal authentication requests. 
 *          Queries database, validates passwords, and initiates active session parameters (role, email, customer_id).
 * Input Params: JSON body (email, password)
 * Validation rules:
 *   - Fields must not be empty.
 *   - Limits maximum input sizes.
 * Output: JSON response returning verification status, name, role, and redirect targets.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only POST requests are accepted."
    ]);
    exit();
}

// === SECTION: INPUT HANDLING ===
$inputData = json_decode(file_get_contents("php://input"), true);

if ($inputData === null) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid JSON formatting in the request body."
    ]);
    exit();
}

$login_input = null;
if (!empty($inputData['username_or_email'])) {
    $login_input = trim($inputData['username_or_email']);
} elseif (!empty($inputData['username'])) {
    $login_input = trim($inputData['username']);
} elseif (!empty($inputData['email'])) {
    $login_input = trim($inputData['email']);
}

$password = isset($inputData['password']) ? $inputData['password'] : null;

// === SECTION: INPUT VALIDATION ===
if (empty($login_input) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Username/Email and Password are required."
    ]);
    exit();
}

if (strlen($login_input) > MAX_USERNAME_LENGTH) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Username/Email must not exceed " . MAX_USERNAME_LENGTH . " characters."
    ]);
    exit();
}

if (strlen($password) > MAX_PASSWORD_LENGTH) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must not exceed " . MAX_PASSWORD_LENGTH . " characters."
    ]);
    exit();
}

if (strpos($login_input, '@') !== false && !filter_var($login_input, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please provide a valid email address."
    ]);
    exit();
}

// === SECTION: DATABASE QUERY & AUTHENTICATION ===
try {
    // ------------------------------------------------------------------
    // STEP 1: Query User Table
    // ------------------------------------------------------------------
    $userQuery = "SELECT user_id, customer_id, email, username, password, role 
                  FROM User 
                  WHERE username = :username_input OR email = :email_input 
                  LIMIT 1";
                   
    $userStmt = $conn->prepare($userQuery);
    $userStmt->bindValue(':username_input', $login_input, PDO::PARAM_STR);
    $userStmt->bindValue(':email_input', $login_input, PDO::PARAM_STR);
    $userStmt->execute();
    $user = $userStmt->fetch();

    if ($user) {
        // Support both password_verify and plaintext password fallback (for seeded testing credentials)
        if (password_verify($password, $user['password']) || $password === $user['password']) {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            session_regenerate_id(true);
            
            if ($user['role'] === 'Admin') {
                $_SESSION['user_id'] = (int)$user['user_id'];
                $_SESSION['role'] = 'Admin';
                $_SESSION['username'] = $user['username'];
                $_SESSION['email'] = $user['email'];

                // === SECTION: SUCCESS RESPONSE ===
                http_response_code(200);
                echo json_encode([
                    "status" => "success",
                    "data" => [
                        "role" => "Admin",
                        "admin_id" => (int)$user['user_id'],
                        "message" => "Admin authorization successful!"
                    ]
                ]);
                exit();
            } else {
                // Fetch associated Customer record
                $customerQuery = "SELECT customer_id, full_name, phone_number, customer_type 
                                  FROM Customer 
                                  WHERE customer_id = :customer_id 
                                  LIMIT 1";
                $customerStmt = $conn->prepare($customerQuery);
                $customerStmt->bindValue(':customer_id', $user['customer_id'], PDO::PARAM_INT);
                $customerStmt->execute();
                $customer = $customerStmt->fetch();

                $customer_id = 0;
                $full_name = '';
                $subscription_id = 0;

                if ($customer) {
                    $customer_id = (int)$customer['customer_id'];
                    $full_name = $customer['full_name'];

                    // Fetch Subscription details
                    $subQuery = "SELECT subscription_id, plan_status FROM Subscription WHERE customer_id = :customer_id LIMIT 1";
                    $subStmt = $conn->prepare($subQuery);
                    $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
                    $subStmt->execute();
                    $subscription = $subStmt->fetch();
                    if ($subscription) {
                        $subscription_id = (int)$subscription['subscription_id'];
                        $plan_status = $subscription['plan_status'];

                        // Enforce: User should not be able to log in / open an account that hasn't been approved yet
                        if ($plan_status === 'Payment Pending') {
                            http_response_code(403);
                            echo json_encode([
                                "status" => "error",
                                "message" => "Your subscriber account is pending admin approval. You will be able to access your account once your subscription and payment have been verified by an admin."
                            ]);
                            exit();
                        } elseif ($plan_status === 'Expired') {
                            http_response_code(403);
                            echo json_encode([
                                "status" => "error",
                                "message" => "Your subscription registration has been rejected or has expired. Please contact support or resubmit registration."
                            ]);
                            exit();
                        } elseif ($plan_status !== 'Active') {
                            http_response_code(403);
                            echo json_encode([
                                "status" => "error",
                                "message" => "Your subscription account is inactive. Please contact support."
                            ]);
                            exit();
                        }
                    }
                }

                // If Subscription ID is not available, default to user_id for backward compatibility
                $_SESSION['user_id'] = $subscription_id ? $subscription_id : (int)$user['user_id'];
                $_SESSION['role'] = 'Subscriber';
                $_SESSION['customer_id'] = $customer_id;
                $_SESSION['email'] = $user['email'];
                $_SESSION['name'] = $full_name;

                // === SECTION: SUCCESS RESPONSE ===
                http_response_code(200);
                echo json_encode([
                    "status" => "success",
                    "data" => [
                        "role" => "Subscriber",
                        "customer_id" => $customer_id,
                        "subscriber_id" => $_SESSION['user_id'],
                        "full_name" => $full_name,
                        "message" => "Subscriber authorization successful!"
                    ]
                ]);
                exit();
            }
        }
    }

    // If no credentials match
    http_response_code(401);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid credentials. Please verify your email/username and password."
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    // Write detailed error message to server's error log
    error_log("Authentication failure: [Code " . $e->getCode() . "] " . $e->getMessage() . "\nTrace: " . $e->getTraceAsString());
    
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred during authentication.",
        "debug_error" => $e->getMessage(),
        "debug_code" => $e->getCode()
    ]);
}
?>
