<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

try {
    require_auth('Admin');

    // 1. Fetch Monthly Roster invoices (subscriber payments)
    $rosterQuery = "SELECT i.invoice_id, 
                           s.customer_id,
                           i.total_amount AS total, 
                           i.invoice_status AS status, 
                           i.issued_at AS date,
                           c.full_name AS client,
                           p.payment_id, 
                           p.payment_status, 
                           p.proof_of_payment AS img
                    FROM Invoice i
                    JOIN Subscription s ON i.subscription_id = s.subscription_id
                    JOIN Customer c ON s.customer_id = c.customer_id
                    LEFT JOIN Payment p ON i.invoice_id = p.invoice_id
                    WHERE i.invoice_type = 'Monthly Roster'
                    ORDER BY i.issued_at DESC";
    $rosterStmt = $conn->prepare($rosterQuery);
    $rosterStmt->execute();
    $rosters = $rosterStmt->fetchAll();

    // Group or label rosters
    // To identify if it is "First Month (Registration)" or "Monthly Renewal":
    // We can count how many Monthly Roster invoices exist for that customer before this one.
    $formattedRosters = [];
    foreach ($rosters as $r) {
        $cid = (int)$r['customer_id'];
        // Check if there are older Monthly Roster invoices for this customer
        $countQuery = "SELECT COUNT(*) FROM Invoice i JOIN Subscription s ON i.subscription_id = s.subscription_id WHERE s.customer_id = :customer_id AND i.invoice_type = 'Monthly Roster' AND i.invoice_id < :invoice_id";
        $countStmt = $conn->prepare($countQuery);
        $countStmt->bindValue(':customer_id', $cid, PDO::PARAM_INT);
        $countStmt->bindValue(':invoice_id', (int)$r['invoice_id'], PDO::PARAM_INT);
        $countStmt->execute();
        $olderCount = (int)$countStmt->fetchColumn();

        $payment_label = ($olderCount === 0) ? "First Month (Registration)" : "Monthly Renewal";

        $img = $r['img'];
        if ($img && !preg_match('/^(http|data:|..\/)/', $img)) {
            $img = '../' . $img;
        }

        $formattedRosters[] = [
            "id" => "INV-" . $r['invoice_id'],
            "invoice_id" => (int)$r['invoice_id'],
            "client" => $r['client'],
            "total" => (float)$r['total'],
            "label" => $payment_label,
            "status" => strtolower($r['status']),
            "payment_status" => $r['payment_status'],
            "img" => $img ? $img : '',
            "date" => substr($r['date'], 0, 10)
        ];
    }

    // 2. Fetch Zero-Value detailing invoices
    $freeQuery = "SELECT i.invoice_id, 
                         i.issued_at AS date,
                         c.full_name AS client,
                         s.service_name
                  FROM Invoice i
                  JOIN Booking b ON i.invoice_id = b.invoice_id
                  JOIN Customer c ON b.customer_id = c.customer_id
                  JOIN Service s ON b.service_id = s.service_id
                  WHERE i.invoice_type = 'Single Detailing' 
                    AND i.total_amount = 0.00
                  ORDER BY i.issued_at DESC";
    $freeStmt = $conn->prepare($freeQuery);
    $freeStmt->execute();
    $frees = $freeStmt->fetchAll();

    $formattedFrees = array_map(function($f) {
        return [
            "id" => "INV-" . $f['invoice_id'],
            "client" => $f['client'],
            "service" => $f['service_name'],
            "date" => substr($f['date'], 0, 10)
        ];
    }, $frees);

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => [
            "roster_payments" => $formattedRosters,
            "free_bookings" => $formattedFrees
        ]
    ]);

} catch (Exception $e) {
    error_log("Failed to fetch subscriber ledgers: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while compiling subscriber ledgers."
    ]);
}
?>
