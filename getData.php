<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "localhost";
$username = "root";
$password = "";
$database = "montage_carwash_db";

$connection = new mysqli($host, $username, $password, $database);

if ($connection->connect_error) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed",
        "error" => $connection->connect_error
    ]);
    exit();
}

$connection->set_charset("utf8mb4");

function fetchTableData($connection, $tableName) {
    $rows = [];
    $query = "SELECT * FROM `" . $tableName . "`";
    $result = $connection->query($query);

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $result->free();
    }

    return $rows;
}

$response = [
    "status" => "success",
    "data" => [
        "admin" => fetchTableData($connection, "admin"),
        "subscriber" => fetchTableData($connection, "subscriber"),
        "service" => fetchTableData($connection, "service"),
        "customer" => fetchTableData($connection, "customer")
    ]
];

echo json_encode($response);
$connection->close();
