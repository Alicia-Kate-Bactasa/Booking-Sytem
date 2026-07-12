<?php
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

try {
    // Require subscriber authentication
    require_auth('Subscriber');
    verify_csrf_request();

    $customer_id = $_SESSION['customer_id'];

    // Start database transaction
    $conn->beginTransaction();

    // Retrieve active subscription details
    $subQuery = "SELECT subscription_id, plan_status, next_billing_date 
                 FROM Subscription 
                 WHERE customer_id = :customer_id 
                   AND plan_status = 'Active' 
                 LIMIT 1";
    $subStmt = $conn->prepare($subQuery);
    $subStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $subStmt->execute();
    $subscription = $subStmt->fetch();

    if (!$subscription) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "No active subscription found to cancel or plan is already pending cancellation."
        ]);
        exit();
    }

    // Transition state to 'Cancellation Pending'
    $updateQuery = "UPDATE Subscription SET plan_status = 'Cancellation Pending' WHERE subscription_id = :sub_id";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->bindValue(':sub_id', $subscription['subscription_id'], PDO::PARAM_INT);
    $updateStmt->execute();

    // Log this transition in System_Logs
    log_system_event($conn, 'Subscription Cancellation Requested', "Customer ID {$customer_id} requested subscription cancellation. Plan status transitioned to Cancellation Pending. Expiry effective after next billing date: {$subscription['next_billing_date']}.");

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Subscription cancellation requested successfully. Your benefits remain active until " . $subscription['next_billing_date']
    ]);

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log("Cancellation failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while canceling the subscription. Please try again."
    ]);
}
?>
