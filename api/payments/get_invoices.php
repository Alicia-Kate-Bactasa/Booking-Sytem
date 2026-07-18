<?php
/**
 * File: api/payments/get_invoices.php
 * Purpose: Fetches the detailing session invoice history records for rendering in the admin dashboard ledger tables.
 *          Maps payment proof images, status flags, total amount values, dates, and names.
 * Input Params: GET request (requires Admin authentication)
 * Logical Rules:
 *   - Prepends '../' to relative database image paths so they load correctly relative to the admin panel.
 * Output: JSON response containing detailed list of invoices.
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET requests are accepted."
    ]);
    exit();
}

try {
    // Require admin privilege
    require_auth('Admin');

    $query = "SELECT i.invoice_id, 
                     i.total_amount AS total, 
                     i.invoice_type AS type, 
                     i.invoice_status AS status, 
                     i.issued_at AS date,
                     c.full_name AS client,
                     ser.service_name,
                     p.payment_id, 
                     p.payment_method, 
                     p.payment_status, 
                     p.proof_of_payment AS img
              FROM Invoice i
              JOIN Booking b ON i.booking_id = b.booking_id
              JOIN Customer c ON b.customer_id = c.customer_id
              JOIN Service ser ON b.service_id = ser.service_id
              LEFT JOIN Payment p ON i.invoice_id = p.invoice_id
              WHERE i.invoice_type = 'Single Detailing' AND i.total_amount > 0.00
              ORDER BY i.issued_at DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $invoices = $stmt->fetchAll();
 
    // Map properties for UI compatibility
    $formattedInvoices = array_map(function($inv) {
        $serviceName = $inv['service_name'];
        
        $img = $inv['img'];
        if ($img && !preg_match('/^(http|data:|..\/)/', $img)) {
            $img = '../' . $img;
        }
        
        return [
            "id" => "INV-" . $inv['invoice_id'],
            "invoice_id" => (int)$inv['invoice_id'],
            "type" => $inv['type'] === 'Monthly Roster' ? 'subscriber' : 'regular',
            "status" => strtolower($inv['status']),
            "client" => $inv['client'],
            "service" => $serviceName,
            "total" => (float)$inv['total'],
            "img" => $img ? $img : '',
            "date" => substr($inv['date'], 0, 10)
        ];
    }, $invoices);

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $formattedInvoices
    ]);

} catch (Exception $e) {
    error_log("Failed to fetch invoices: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching invoice ledger: " . $e->getMessage()
    ]);
}
?>
