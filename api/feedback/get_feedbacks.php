<?php
/**
 * File: api/feedback/get_feedbacks.php
 * Purpose: Retrieves all active customer rating and feedback comment records.
 * Input Params: GET request
 * Output: JSON response returning lists of feedback records (name, rating, comments, date).
 */

// === SECTION: HEADER & CORS ===
header("Content-Type: application/json; charset=UTF-8");

// === SECTION: CENTRALIZED CONNECTION ===
require_once __DIR__ . '/../utils/config.php';

// === SECTION: REQUEST METHOD VALIDATION ===
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => "error",
        "message" => "Method Not Allowed. Only GET requests are accepted."
    ]);
    exit();
}

// === SECTION: DATABASE QUERY & EXECUTION ===
try {
    // Require Admin authentication
    require_auth('Admin');

    $ensureFeedbackSchema = function ($conn) {
        // Create table if it doesn't exist
        $tableCheck = $conn->query("SHOW TABLES LIKE 'Feedback'");
        if (!$tableCheck->fetch()) {
            $conn->exec("CREATE TABLE Feedback (
                feedback_id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT UNIQUE NULL,
                customer_id INT NULL,
                rating INT CHECK (rating >= 1 AND rating <= 5),
                comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES Booking(booking_id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }

        $requiredColumns = [
            'client_name' => "VARCHAR(255) NULL",
            'service_name' => "VARCHAR(255) NULL",
            'feedback_type' => "VARCHAR(20) NOT NULL DEFAULT 'subscriber'"
        ];

        foreach ($requiredColumns as $columnName => $definition) {
            $columnCheckStmt = $conn->query("SHOW COLUMNS FROM Feedback LIKE " . $conn->quote($columnName));
            if (!$columnCheckStmt->fetch()) {
                $conn->exec("ALTER TABLE Feedback ADD COLUMN {$columnName} {$definition}");
            }
        }

        $nullableColumns = ['booking_id', 'customer_id'];
        foreach ($nullableColumns as $columnName) {
            $columnStmt = $conn->query("SHOW COLUMNS FROM Feedback LIKE " . $conn->quote($columnName));
            $columnInfo = $columnStmt->fetch(PDO::FETCH_ASSOC);
            if ($columnInfo && strtoupper($columnInfo['Null']) === 'NO') {
                $conn->exec("ALTER TABLE Feedback MODIFY COLUMN {$columnName} {$columnInfo['Type']} NULL");
            }
        }
    };

    $ensureFeedbackSchema($conn);

    $query = "SELECT 
                f.feedback_id,
                f.booking_id,
                f.customer_id,
                f.rating,
                f.comments,
                f.created_at,
                                f.feedback_type,
                                COALESCE(f.client_name, c.full_name, 'Guest') AS client,
                                COALESCE(f.service_name, s.service_name, 'N/A') AS service
              FROM Feedback f
                            LEFT JOIN Customer c ON f.customer_id = c.customer_id
                            LEFT JOIN Booking b ON f.booking_id = b.booking_id
                            LEFT JOIN Service s ON b.service_id = s.service_id
              ORDER BY f.created_at DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    $feedbacks = $stmt->fetchAll();
    
    // === SECTION: SUCCESS RESPONSE ===
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $feedbacks
    ]);

// === SECTION: ERROR HANDLING ===
} catch (PDOException $e) {
    error_log("Failed to fetch feedbacks: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred while fetching feedback data."
    ]);
}
?>
