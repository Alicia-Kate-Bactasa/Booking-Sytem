<?php
/**
 * File: api/auth/csrf.php
 * Purpose: Exposes an endpoint to retrieve/generate the CSRF token for the current session.
 */

require_once '../config.php';

header("Content-Type: application/json; charset=UTF-8");

echo json_encode([
    "status" => "success",
    "csrf_token" => get_csrf_token()
]);
?>
