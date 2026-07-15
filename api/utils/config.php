<?php
/**
* Database Configuration and Connection Script
*
* Establishes a secure PDO connection to the MySQL database "montage_carwash_db".
* Sets appropriate CORS (Cross-Origin Resource Sharing) headers to allow seamless
* communication with decoupled frontend applications, and configures PDO to use
* safe UTF-8 encoding and throw exceptions on error.
*/

// Authentication and input validation limits
if (!defined('MAX_EMAIL_LENGTH')) {
   define('MAX_EMAIL_LENGTH', 255);
}
if (!defined('MAX_USERNAME_LENGTH')) {
   define('MAX_USERNAME_LENGTH', 40);
}
if (!defined('MAX_PASSWORD_LENGTH')) {
   define('MAX_PASSWORD_LENGTH', 255);
}

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

// Handle preflight OPTIONS request gracefully for cross-origin requests
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
   http_response_code(200);
   exit();
}

// Secure session configuration and initialization
if (session_status() === PHP_SESSION_NONE && isset($_SERVER['REQUEST_METHOD'])) {
   ini_set('session.cookie_httponly', 1);
   ini_set('session.use_only_cookies', 1);
   ini_set('session.cookie_path', '/');
   if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
       ini_set('session.cookie_secure', 1);
   }
   session_start();
}

/**
* Checks if the current session is authenticated for a given role or roles.
* Terminating the request with a JSON response if unauthorized.
* * @param string|array $allowedRoles Roles permitted to access the resource
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

/**
* Generates a secure CSRF token and stores it in the session.
*/
function get_csrf_token() {
   if (session_status() === PHP_SESSION_NONE) {
       session_start();
   }
   if (empty($_SESSION['csrf_token'])) {
       $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
   }
   return $_SESSION['csrf_token'];
}

/**
* Validates a given CSRF token against the session token.
*/
function validate_csrf_token($token) {
   if (session_status() === PHP_SESSION_NONE) {
       session_start();
   }
   return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
* Helper function to retrieve all headers in any server environment.
*/
if (!function_exists('getallheaders')) {
   function getallheaders() {
       $headers = [];
       foreach ($_SERVER as $name => $value) {
           if (substr($name, 0, 5) == 'HTTP_') {
               $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
           }
       }
       return $headers;
   }
}

/**
* Automatically validates the CSRF token on POST requests.
*/
function verify_csrf_request() {
   if ($_SERVER['REQUEST_METHOD'] === 'POST') {
       $headers = array_change_key_case(getallheaders(), CASE_LOWER);
       $token = isset($headers['x-csrf-token']) ? $headers['x-csrf-token'] : '';
       if (!validate_csrf_token($token)) {
           http_response_code(403);
           echo json_encode([
               "status" => "error",
               "message" => "Invalid or missing CSRF token."
           ]);
           exit();
       }
   }
}

/**
* Logs a system event into the System_Logs table.
*/
function log_system_event($conn, $event_type, $description) {
   error_log("System Event [{$event_type}]: {$description}");
}


// =========================================================================
// PRODUCTION DATABASE BOUNDARY - DCISM REMOTE SERVER CONFIGURATION
// =========================================================================
$host = "localhost";                       // Kept as localhost since PHP and MySQL run on the same machine
$db_name = "s22104079_montageAutoStudio";  // Your live full database name
$username = "s22104079_montageAutoStudio"; // Your DCISM username is identical to the full DB name
$password = "b00kn0t!";      // REPLACE WITH THE PASSWORD YOU SET IN ADMIN.DCISM.ORG
$conn = null;

try {
   // Establish connection using PDO with forced UTF-8 (utf8mb4) encoding
   $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8mb4", $username, $password);
  
   // Configure PDO attributes
   $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
   $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
   $conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $exception) {
   // Log the error message to the system log instead of leaking credentials to response
   error_log("Database connection failed: " . $exception->getMessage());
  
   // Respond with a clean 500 server error JSON if the database connection fails
   http_response_code(500);
   echo json_encode([
       "status" => "error",
       "message" => "Remote database sync offline. Please ensure the database server is configured correctly."
   ]);
   exit();
}

// =========================================================================
// EMAIL / MAILER SERVICE CONFIGURATION
// =========================================================================
define('BREVO_API_KEY', getenv('BREVO_API_KEY') ?: '');
define('MAIL_FROM_EMAIL', getenv('MAIL_FROM_EMAIL') ?: 'bactasa.ak@gmail.com');
define('MAIL_FROM_NAME', getenv('MAIL_FROM_NAME') ?: 'Montage Auto Studio');
define('MAIL_REPLY_TO', getenv('MAIL_REPLY_TO') ?: 'bactasa.kate@gmail.com');

// Gmail SMTP Configuration
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', getenv('SMTP_PORT') ?: 587);
define('SMTP_SECURE', getenv('SMTP_SECURE') ?: 'tls');
define('SMTP_USER', getenv('SMTP_USER') ?: 'bactasa.ak@gmail.com');
define('SMTP_PASS', getenv('SMTP_PASS') ?: ''); // Your 16-character Google App Password
