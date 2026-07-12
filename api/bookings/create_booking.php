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

$customer_id = isset($inputData['customer_id']) ? $inputData['customer_id'] : null;
$service_id = isset($inputData['service_id']) ? $inputData['service_id'] : null;
$scheduled_date = isset($inputData['scheduled_date']) ? $inputData['scheduled_date'] : null;
$time_slot = isset($inputData['time_slot']) ? trim($inputData['time_slot']) : null;

// === SECTION: INPUT VALIDATION ===
if (empty($customer_id) || empty($service_id) || empty($scheduled_date) || empty($time_slot)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. customer_id, service_id, scheduled_date, and time_slot are required fields."
    ]);
    exit();
}

if (!filter_var($customer_id, FILTER_VALIDATE_INT) || !filter_var($service_id, FILTER_VALIDATE_INT)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid ID formatting. customer_id and service_id must be integers."
    ]);
    exit();
}

// === SECTION: DATABASE TRANSACTION & OPERATION ===
try {
    // Require authentication (either Subscriber or Admin)
    require_auth(['Subscriber', 'Admin']);
    verify_csrf_request();

    // If logged in as Subscriber, enforce security boundaries by overriding customer_id
    if ($_SESSION['role'] === 'Subscriber') {
        $customer_id = $_SESSION['customer_id'];
    }

    // Start transaction
    $conn->beginTransaction();

    // 1. Retrieve the service price
    $serviceQuery = "SELECT service_price FROM Service WHERE service_id = :service_id LIMIT 1";
    $serviceStmt = $conn->prepare($serviceQuery);
    $serviceStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $serviceStmt->execute();
    $service = $serviceStmt->fetch();

    if (!$service) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "The requested service was not found in the master catalog."
        ]);
        exit();
    }
    $purchased_price = $service['service_price'];

    // Helper function to convert time slot (e.g. "09:00 AM") to minutes since midnight
    if (!function_exists('getMinutesFromSlot')) {
        function getMinutesFromSlot($timeStr) {
            $timeStr = trim($timeStr);
            $parts = explode(' ', $timeStr);
            if (count($parts) < 2) return 0;
            $hm = explode(':', $parts[0]);
            $h = (int)$hm[0];
            $m = isset($hm[1]) ? (int)$hm[1] : 0;
            $ampm = strtoupper($parts[1]);
            
            if ($ampm === 'PM' && $h !== 12) {
                $h += 12;
            }
            if ($ampm === 'AM' && $h === 12) {
                $h = 0;
            }
            return $h * 60 + $m;
        }
    }

    $new_start = getMinutesFromSlot($time_slot);
    $new_end = $new_start + (int)$service['service_duration'];

    // 2. Perform the capacity-aware non-overlap check on Bay 1
    $overlapQuery1 = "SELECT b.booking_id 
                      FROM Booking b
                      JOIN Service s ON b.service_id = s.service_id
                      WHERE b.scheduled_date = :date 
                        AND b.bay_number = 'Bay 1' 
                        AND b.booking_status NOT IN ('Cancelled', 'No-Show')
                        AND (
                          (TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) < :new_end 
                          AND 
                          ((TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) + s.service_duration) > :new_start
                        ) LIMIT 1";
    $overlapStmt1 = $conn->prepare($overlapQuery1);
    $overlapStmt1->bindValue(':date', $scheduled_date, PDO::PARAM_STR);
    $overlapStmt1->bindValue(':new_start', $new_start, PDO::PARAM_INT);
    $overlapStmt1->bindValue(':new_end', $new_end, PDO::PARAM_INT);
    $overlapStmt1->execute();
    $bay1Occupied = $overlapStmt1->fetch();

    $bay_number = null;
    if (!$bay1Occupied) {
        $bay_number = 'Bay 1';
    } else {
        // Check Bay 2
        $overlapQuery2 = "SELECT b.booking_id 
                          FROM Booking b
                          JOIN Service s ON b.service_id = s.service_id
                          WHERE b.scheduled_date = :date 
                            AND b.bay_number = 'Bay 2' 
                            AND b.booking_status NOT IN ('Cancelled', 'No-Show')
                            AND (
                              (TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) < :new_end 
                              AND 
                              ((TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) + s.service_duration) > :new_start
                            ) LIMIT 1";
        $overlapStmt2 = $conn->prepare($overlapQuery2);
        $overlapStmt2->bindValue(':date', $scheduled_date, PDO::PARAM_STR);
        $overlapStmt2->bindValue(':new_start', $new_start, PDO::PARAM_INT);
        $overlapStmt2->bindValue(':new_end', $new_end, PDO::PARAM_INT);
        $overlapStmt2->execute();
        $bay2Occupied = $overlapStmt2->fetch();

        if (!$bay2Occupied) {
            $bay_number = 'Bay 2';
        } else {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            http_response_code(409); // Conflict
            echo json_encode([
                "status" => "error",
                "message" => "The selected time slot is fully booked for this date. Please choose a different date or time slot."
            ]);
            exit();
        }
    }

    // 3. Check customer type to see if they are a subscriber or regular guest
    $custQuery = "SELECT customer_type FROM Customer WHERE customer_id = :customer_id LIMIT 1";
    $custStmt = $conn->prepare($custQuery);
    $custStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $custStmt->execute();
    $customer = $custStmt->fetch();

    $invoice_id = null;
    $booking_status = 'Pending';

    if ($customer && $customer['customer_type'] === 'Subscriber') {
        // Zero-Value Invoices: To maintain a complete activity ledger, every booking generates an Invoice row
        // For subscribers: total_amount is 0.00; invoice_status is marked 'Included'
        $invoiceQuery = "INSERT INTO Invoice (customer_id, total_amount, invoice_type, invoice_status) 
                         VALUES (:customer_id, 0.00, 'Single Detailing', 'Included')";
        $invoiceStmt = $conn->prepare($invoiceQuery);
        $invoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $invoiceStmt->execute();
        $invoice_id = (int)$conn->lastInsertId();
        
        $booking_status = 'Pending'; // Straight to Pending
    } else {
        // Create a standard Pending Invoice for walk-in/regular customer
        $invoiceQuery = "INSERT INTO Invoice (customer_id, total_amount, invoice_type, invoice_status) 
                         VALUES (:customer_id, :total_amount, 'Single Detailing', 'Pending')";
        $invoiceStmt = $conn->prepare($invoiceQuery);
        $invoiceStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
        $invoiceStmt->bindValue(':total_amount', $purchased_price, PDO::PARAM_STR);
        $invoiceStmt->execute();
        $invoice_id = (int)$conn->lastInsertId();
        
        $booking_status = 'Pending Verification';
    }

    // 4. Insert booking with bay_number, purchased_price, and invoice_id
    $query = "INSERT INTO Booking (customer_id, service_id, invoice_id, scheduled_date, time_slot, bay_number, purchased_price, booking_status) 
              VALUES (:customer_id, :service_id, :invoice_id, :scheduled_date, :time_slot, :bay_number, :purchased_price, :booking_status)";
              
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
    $stmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $stmt->bindValue(':invoice_id', $invoice_id, $invoice_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $stmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $stmt->bindValue(':bay_number', $bay_number, PDO::PARAM_STR);
    $stmt->bindValue(':purchased_price', $purchased_price, PDO::PARAM_STR);
    $stmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        $booking_id = (int)$conn->lastInsertId();
        // Log transaction in System_Logs
        log_system_event($conn, 'Booking Created', "Booking ID {$booking_id} created for Customer ID {$customer_id}. Status: {$booking_status}. Linked Invoice ID: {$invoice_id}.");
        $conn->commit();
        // === SECTION: SUCCESS RESPONSE ===
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "data" => [
                "message" => "Booking successfully saved to database!",
                "customer_id" => $customer_id,
                "service_id" => $service_id,
                "scheduled_date" => $scheduled_date,
                "time_slot" => $time_slot,
                "bay_number" => $bay_number,
                "purchased_price" => $purchased_price
            ]
        ]);
    } else {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Failed to save booking. Database did not execute the operation."
        ]);
    }
// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to create booking: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while attempting to write booking to the database."
    ]);
}
?>
