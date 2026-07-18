<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../config.php';

try {
    // 1. Run migration to make customer_id nullable in case it failed
    try {
        $conn->exec("ALTER TABLE Booking MODIFY customer_id INT(11) NULL");
        $migration_status = "Successfully altered Booking table to make customer_id nullable.";
    } catch (Exception $e) {
        $migration_status = "Alter table failed: " . $e->getMessage();
    }

    // 2. Describe Booking table structure
    $stmt = $conn->query("DESCRIBE Booking");
    $structure = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "migration_status" => $migration_status,
        "booking_table_structure" => $structure
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => "Script execution failed: " . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
