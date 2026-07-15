<?php
/**
 * File: api/bookings/check_availability.php
 * Purpose: Public endpoint to check how many active detailing slots are occupied on a specific date and time window.
 *          Helps client check bay constraints before scheduling a wash.
 * Input Params: GET or POST (date, time_slot)
 * Validation rules:
 *   - Date must be present and correctly formatted.
 * Output: JSON response returning the counts of occupied slots and confirmation of availability.
 */

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

// === SECTION: INPUT HANDLING ===
$inputData = $_SERVER['REQUEST_METHOD'] === 'POST' 
    ? json_decode(file_get_contents("php://input"), true) 
    : $_GET;

$scheduled_date = isset($inputData['scheduled_date']) ? trim($inputData['scheduled_date']) : (isset($inputData['date']) ? trim($inputData['date']) : null);
$service_id = isset($inputData['service_id']) ? (int)$inputData['service_id'] : null;
$duration = isset($inputData['duration']) ? (int)$inputData['duration'] : null;
$time_slot = isset($inputData['time_slot']) ? trim($inputData['time_slot']) : null;
$bay_number = isset($inputData['bay_number']) ? trim($inputData['bay_number']) : (isset($inputData['bay']) ? trim($inputData['bay']) : null);

if (empty($scheduled_date)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Incomplete request. scheduled_date is required."
    ]);
    exit();
}

// Helper to convert time slot (e.g. "09:00 AM") to minutes since midnight
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

// Helper to convert minutes since midnight back to slot string format
function minutesToSlotString($minutes) {
    $h = floor($minutes / 60);
    $m = $minutes % 60;
    $ampm = 'AM';
    if ($h >= 12) {
        $ampm = 'PM';
        if ($h > 12) {
            $h -= 12;
        }
    }
    if ($h == 0) {
        $h = 12;
    }
    return sprintf('%02d:%02d %s', $h, $m, $ampm);
}

try {
    // Retrieve service duration if not explicitly passed
    if (empty($duration) && !empty($service_id)) {
        $serviceQuery = "SELECT service_duration FROM Service WHERE service_id = :service_id LIMIT 1";
        $serviceStmt = $conn->prepare($serviceQuery);
        $serviceStmt->bindValue(':service_id', $service_id, PDO::PARAM_INT);
        $serviceStmt->execute();
        $service = $serviceStmt->fetch();
        if ($service) {
            $duration = (int)$service['service_duration'];
        }
    }

    if (empty($duration)) {
        $duration = 30; // default minimum unit duration
    }

    // Case 1: Checking overlap for a specific bay appointment allocation (The "No-Overlap" Rule Validation)
    if (!empty($time_slot) && !empty($bay_number)) {
        $new_start = getMinutesFromSlot($time_slot);
        $new_end = $new_start + $duration;

        // Perform the capacity-aware non-overlap SQL query on the dynamic start/end boundaries of Booking
        $overlapQuery = "SELECT b.booking_id, b.time_slot, s.service_name 
                         FROM Booking b
                         JOIN Service s ON b.service_id = s.service_id
                         WHERE b.scheduled_date = :date 
                           AND b.bay_number = :bay 
                           AND b.booking_status NOT IN ('Cancelled', 'No-Show')
                           AND (
                             (TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) < :new_end 
                             AND 
                             ((TIME_TO_SEC(STR_TO_DATE(b.time_slot, '%h:%i %p')) / 60) + s.service_duration) > :new_start
                           )";
        
        $overlapStmt = $conn->prepare($overlapQuery);
        $overlapStmt->bindValue(':date', $scheduled_date, PDO::PARAM_STR);
        $overlapStmt->bindValue(':bay', $bay_number, PDO::PARAM_STR);
        $overlapStmt->bindValue(':new_start', $new_start, PDO::PARAM_INT);
        $overlapStmt->bindValue(':new_end', $new_end, PDO::PARAM_INT);
        $overlapStmt->execute();
        $overlappingBookings = $overlapStmt->fetchAll();

        $available = count($overlappingBookings) === 0;

        echo json_encode([
            "status" => "success",
            "available" => $available,
            "overlapping" => $overlappingBookings
        ]);
        exit();
    }

    // Case 2: Generating all available time slots for the dynamic scheduler
    // Operational timeline units (30-minute intervals)
    $allSlots = [
        '09:00 AM' => 540,
        '09:30 AM' => 570,
        '10:00 AM' => 600,
        '10:30 AM' => 630,
        '11:00 AM' => 660,
        '11:30 AM' => 690,
        '02:00 PM' => 840,
        '02:30 PM' => 870,
        '03:00 PM' => 900,
        '03:30 PM' => 930,
        '04:00 PM' => 960,
        '04:30 PM' => 990
    ];

    // Fetch all active bookings on this date
    $query = "SELECT b.time_slot, s.service_duration, b.bay_number 
              FROM Booking b
              JOIN Service s ON b.service_id = s.service_id
              WHERE b.scheduled_date = :scheduled_date 
                AND b.booking_status NOT IN ('Cancelled', 'No-Show')";
    $stmt = $conn->prepare($query);
    $stmt->bindValue(':scheduled_date', $scheduled_date, PDO::PARAM_STR);
    $stmt->execute();
    $existingBookings = $stmt->fetchAll();

    $availableSlots = [];

    foreach ($allSlots as $slotName => $newStart) {
        $newEnd = $newStart + $duration;

        // Operational timeline limits constraint verification
        // Morning Block: 09:00 AM to 12:00 PM (540 to 720 minutes)
        // Afternoon Block: 02:00 PM to 05:00 PM (840 to 1020 minutes)
        $fitsMorning = ($newStart >= 540 && $newEnd <= 720);
        $fitsAfternoon = ($newStart >= 840 && $newEnd <= 1020);

        if (!$fitsMorning && !$fitsAfternoon) {
            continue; // Out of operational limits
        }

        $bay1Free = true;
        $bay2Free = true;

        foreach ($existingBookings as $eb) {
            $ebStart = getMinutesFromSlot($eb['time_slot']);
            $ebEnd = $ebStart + (int)$eb['service_duration'];

            // Overlap check
            if ($newStart < $ebEnd && $ebStart < $newEnd) {
                if ($eb['bay_number'] === 'Bay 1') {
                    $bay1Free = false;
                }
                if ($eb['bay_number'] === 'Bay 2') {
                    $bay2Free = false;
                }
            }
        }

        if ($bay1Free || $bay2Free) {
            $availableSlots[] = [
                "time_slot" => $slotName,
                "display_label" => $slotName . " - " . minutesToSlotString($newEnd),
                "allocated_bay" => $bay1Free ? 'Bay 1' : 'Bay 2'
            ];
        }
    }

    echo json_encode([
        "status" => "success",
        "data" => $availableSlots
    ]);

} catch (PDOException $e) {
    error_log("Check availability failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while evaluating slot availability."
    ]);
}
?>
