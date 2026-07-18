<?php
/**
 * File: api/bookings/create_booking.php
 * Purpose: Registers an appointment booking for active VIP subscribers.
 *          Checks calendar slot capacity limitations, inserts a new Booking, creates a 0-amount Invoice (since VIP is prepaid),
 *          logs system events, and sends an HTML invoice confirmation email highlighting their Booking Reference ID.
 * Input Params: JSON body (service_id, scheduled_date, time_slot, bay_number)
 * Validation rules:
 *   - User must be logged in as a Subscriber.
 *   - The booking date must be today or in the future (no past date bookings).
 *   - The time slot bay capacity ceiling constraint (max 2 cars) must not be exceeded.
 * Output: JSON response indicating success or specific booking limitation error.
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

$customer_id = isset($inputData['customer_id']) ? (int)$inputData['customer_id'] : null;
$admin_user_id = isset($inputData['user_id']) ? (int)$inputData['user_id'] : null;
$service_id = isset($inputData['service_id']) ? (int)$inputData['service_id'] : null;
$scheduled_date = isset($inputData['scheduled_date']) ? $inputData['scheduled_date'] : null;
$time_slot = isset($inputData['time_slot']) ? trim($inputData['time_slot']) : null;

// === SECTION: INPUT VALIDATION ===
if (empty($service_id) || empty($scheduled_date) || empty($time_slot)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. service_id, scheduled_date, and time_slot are required fields."
    ]);
    exit();
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$isSubscriberRole = (isset($_SESSION['role']) && $_SESSION['role'] === 'Subscriber');

// If Admin, they must provide either customer_id or user_id
if (!$isSubscriberRole && empty($customer_id) && empty($admin_user_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. Administrators must specify either customer_id or user_id."
    ]);
    exit();
}

if (strtotime($scheduled_date) < strtotime(date('Y-m-d'))) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Booking date cannot be in the past."
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

    // 1. Retrieve the service price, duration and name
    $serviceQuery = "SELECT service_name, service_price, service_duration FROM Service WHERE service_id = :service_id LIMIT 1";
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
                        AND b.bay_number = 1 
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
        $bay_number = 1;
    } else {
        // Check Bay 2
        $overlapQuery2 = "SELECT b.booking_id 
                          FROM Booking b
                          JOIN Service s ON b.service_id = s.service_id
                          WHERE b.scheduled_date = :date 
                            AND b.bay_number = 2 
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
            $bay_number = 2;
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

    // Resolve user_id
    $user_id = null;
    $isSubscriber = false;
    $customer_email = '';
    $customer_name = '';

    if ($_SESSION['role'] === 'Subscriber') {
        $user_id = $_SESSION['user_id'];
        $isSubscriber = true;
        
        $subStmt = $conn->prepare("SELECT email, username AS full_name FROM User WHERE user_id = :user_id LIMIT 1");
        $subStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
        $subStmt->execute();
        $subData = $subStmt->fetch();
        if ($subData) {
            $customer_email = $subData['email'];
            $customer_name = $subData['full_name'];
        }
        $customer_id = null;
    } else {
        // Admin
        if ($admin_user_id) {
            $user_id = $admin_user_id;
            $subStmt = $conn->prepare("SELECT email, username AS full_name FROM User WHERE user_id = :user_id LIMIT 1");
            $subStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
            $subStmt->execute();
            $subData = $subStmt->fetch();
            if ($subData) {
                $customer_email = $subData['email'];
                $customer_name = $subData['full_name'];
                $isSubscriber = true;
            }
            $customer_id = null;
        } else {
            $user_id = null;
            $custQuery = "SELECT c.customer_type, c.full_name, c.email FROM Customer c WHERE c.customer_id = :customer_id LIMIT 1";
            $custStmt = $conn->prepare($custQuery);
            $custStmt->bindValue(':customer_id', $customer_id, PDO::PARAM_INT);
            $custStmt->execute();
            $customerInfo = $custStmt->fetch();
            if ($customerInfo) {
                $customer_email = $customerInfo['email'];
                $customer_name = $customerInfo['full_name'];
                $isSubscriber = false;
            }
        }
    }

    $booking_status = $isSubscriber ? 'Pending' : 'Pending Verification';

    // 4. Insert booking first (without invoice_id, but with user_id)
    $query = "INSERT INTO Booking (customer_id, user_id, service_id, scheduled_date, time_slot, bay_number, purchased_price, booking_status) 
              VALUES (:customer_id, :user_id, :service_id, :scheduled_date, :time_slot, :bay_number, :purchased_price, :booking_status)";
              
    $stmt = $conn->prepare($query);
    
    $stmt->bindValue(':customer_id', $customer_id, $customer_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmt->bindValue(':user_id', $user_id, $user_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
    $stmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $stmt->bindValue(':time_slot', $time_slot, PDO::PARAM_STR);
    $stmt->bindValue(':bay_number', $bay_number, PDO::PARAM_INT);
    $stmt->bindValue(':purchased_price', $purchased_price, PDO::PARAM_STR);
    $stmt->bindValue(':booking_status', $booking_status, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        $booking_id = (int)$conn->lastInsertId();
        $invoice_id = null;
        if ($isSubscriber) {
            // Fetch active subscription ID via user_id
            $subIdQuery = "SELECT subscription_id FROM Subscription WHERE user_id = :user_id AND plan_status IN ('Active', 'Cancellation Pending') LIMIT 1";
            $subIdStmt = $conn->prepare($subIdQuery);
            $subIdStmt->bindValue(':user_id', $user_id, PDO::PARAM_INT);
            $subIdStmt->execute();
            $subData = $subIdStmt->fetch();
            $subscription_id = $subData ? (int)$subData['subscription_id'] : null;

            // Zero-Value Invoices: To maintain a complete activity ledger, every booking generates an Invoice row
            $invoiceQuery = "INSERT INTO Invoice (booking_id, subscription_id, total_amount, invoice_type, invoice_status) 
                             VALUES (:booking_id, :subscription_id, 0.00, 'Single Detailing', 'Paid')";
            $invoiceStmt = $conn->prepare($invoiceQuery);
            $invoiceStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
            $invoiceStmt->bindValue(':subscription_id', $subscription_id, $subscription_id === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $invoiceStmt->execute();
            $invoice_id = (int)$conn->lastInsertId();
        } else {
            // Create a standard Pending Invoice for walk-in/regular customer
            $invoiceQuery = "INSERT INTO Invoice (booking_id, subscription_id, total_amount, invoice_type, invoice_status) 
                             VALUES (:booking_id, NULL, :total_amount, 'Single Detailing', 'Pending')";
            $invoiceStmt = $conn->prepare($invoiceQuery);
            $invoiceStmt->bindValue(':booking_id', $booking_id, PDO::PARAM_INT);
            $invoiceStmt->bindValue(':total_amount', $purchased_price, PDO::PARAM_STR);
            $invoiceStmt->execute();
            $invoice_id = (int)$conn->lastInsertId();
        }

        // Log transaction in System_Logs
        log_system_event($conn, 'Booking Created', "Booking ID {$booking_id} created for Customer ID {$customer_id}. Status: {$booking_status}. Linked Invoice ID: {$invoice_id}.");
        $conn->commit();

        // Send booking confirmation email to client
        if (!empty($customer_email) && filter_var($customer_email, FILTER_VALIDATE_EMAIL)) {
            require_once __DIR__ . '/../utils/mailer.php';
            $clientEmail = $customer_email;
            $fullName = $customer_name;
            $subject = "Booking Received - Montage Auto Studio";

            $originalPrice = (float)$service['service_price'];
            
            $subtotal = $isSubscriber ? $originalPrice : (float)$purchased_price;
            $discount = $isSubscriber ? $originalPrice : 0.0;
            $totalDue = $isSubscriber ? 0.0 : (float)$purchased_price;

            $invoiceData = [
                'title' => 'Booking Invoice',
                'invoice_no' => 'INV-' . ($invoice_id ?: $booking_id),
                'date' => date('Y-m-d'),
                'client_name' => $fullName,
                'client_email' => $clientEmail,
                'item_name' => $service['service_name'],
                'item_subtext' => "Scheduled for Bay {$bay_number} on {$scheduled_date} at {$time_slot}",
                'item_price' => $subtotal,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total_due' => $totalDue,
                'booking_id' => $booking_id
            ];

            if ($booking_status === 'Pending') {
                // VIP subscriber (free session)
                $invoiceData['status_bg'] = '#f4fbf7';
                $invoiceData['status_border'] = '#27ae60';
                $invoiceData['status_color'] = '#27ae60';
                $invoiceData['status_label'] = 'APPROVED (COVERED BY VIP)';
                $invoiceData['status_detail'] = 'Your booking is scheduled. Since this is covered by your VIP subscription, no extra payment is required. We look forward to servicing your vehicle!';
            } else {
                // Regular customer (payment pending approval)
                $invoiceData['status_bg'] = '#fef9e7';
                $invoiceData['status_border'] = '#f39c12';
                $invoiceData['status_color'] = '#d35400';
                $invoiceData['status_label'] = 'PENDING VERIFICATION';
                $invoiceData['status_detail'] = 'We have received your booking request. Please ensure you have uploaded your GCash payment proof in your dashboard to secure your slot.';
            }

            $htmlContent = Mailer::formatInvoice($invoiceData);
            Mailer::send($clientEmail, $subject, $htmlContent);
        }

        // === SECTION: SUCCESS RESPONSE ===
        http_response_code(201);
        echo json_encode([
            "status" => "success",
            "data" => [
                "message" => "Booking successfully saved to database!",
                "booking_id" => $booking_id,
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
} catch (PDOException $e) {
    error_log("Failed to create booking: " . $e->getMessage());
    http_response_code(500);
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while attempting to write booking to the database.",
        "debug_error" => $e->getMessage(),
        "migration_error" => isset($_SESSION['migration_error']) ? $_SESSION['migration_error'] : 'None'
    ]);
}
?>
