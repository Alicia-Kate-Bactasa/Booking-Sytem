<?php
// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once '../config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET or POST requests are accepted."
    ]);
    exit();
}

try {
    // Require admin authentication
    require_auth('Admin');

    // 1. Fetch pending_verifications (GCash screenshots for regular bookings)
    $verifyQuery = "SELECT b.booking_id, b.scheduled_date, b.time_slot, b.bay_number, b.purchased_price,
                           s.service_name, c.full_name, c.customer_type,
                           i.invoice_id, i.total_amount, i.invoice_type, i.invoice_status,
                           p.payment_id, p.payment_method, p.payment_status, p.proof_of_payment, p.amount AS paid_amount
                    FROM Booking b
                    JOIN Service s ON b.service_id = s.service_id
                    JOIN Customer c ON b.customer_id = c.customer_id
                    JOIN Invoice i ON b.invoice_id = i.invoice_id
                    JOIN Payment p ON i.invoice_id = p.invoice_id
                    WHERE p.payment_status = 'Pending Approval' 
                      AND b.booking_status = 'Pending Verification'
                      AND i.invoice_status = 'Pending'";
    $verifyStmt = $conn->prepare($verifyQuery);
    $verifyStmt->execute();
    $pending_verifications = $verifyStmt->fetchAll();

    // 2. Fetch pending_registrations (Subscriptions/accounts waiting for activation)
    $regQuery = "SELECT s.subscription_id, s.plan_tier, s.plan_status, s.created_at,
                        c.customer_id, c.full_name, c.phone_number,
                        u.email, u.username,
                        i.invoice_id, i.total_amount,
                        p.payment_id, p.payment_method, p.payment_status, p.proof_of_payment
                 FROM Subscription s
                 JOIN Customer c ON s.customer_id = c.customer_id
                 JOIN User u ON c.user_id = u.user_id
                 JOIN Invoice i ON s.subscription_id = i.subscription_id
                 JOIN Payment p ON i.invoice_id = p.invoice_id
                 WHERE p.payment_status = 'Pending Approval'
                   AND s.plan_status = 'Payment Pending'
                   AND i.invoice_type = 'Monthly Roster'
                   AND i.invoice_status = 'Pending'";
    $regStmt = $conn->prepare($regQuery);
    $regStmt->execute();
    $pending_registrations = $regStmt->fetchAll();

    // 3. Fetch billing_alerts (Overdue subscribers next_billing_date < CURRENT_DATE)
    $alertQuery = "SELECT s.subscription_id, s.customer_id, s.plan_tier, s.plan_status, s.next_billing_date,
                          c.full_name, u.email
                   FROM Subscription s
                   JOIN Customer c ON s.customer_id = c.customer_id
                   JOIN User u ON c.user_id = u.user_id
                   WHERE s.plan_status = 'Active'
                     AND s.next_billing_date < CURRENT_DATE()";
    $alertStmt = $conn->prepare($alertQuery);
    $alertStmt->execute();
    $billing_alerts = $alertStmt->fetchAll();

    // === SECTION: SUCCESS RESPONSE ===
    echo json_encode([
        "status" => "success",
        "data" => [
            "pending_verifications" => $pending_verifications,
            "pending_registrations" => $pending_registrations,
            "billing_alerts" => $billing_alerts
        ]
    ]);

} catch (Exception $e) {
    error_log("Failed to fetch admin dashboard datasets: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while compiling administrative datasets."
    ]);
}
?>
