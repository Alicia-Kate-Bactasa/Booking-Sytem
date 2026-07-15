<?php
/**
 * File: api/test_mail.php
 * Purpose: A diagnostic script to test the SMTP / Brevo API mail service settings.
 * Input Params: GET parameter (to)
 * Output: HTML status page confirming success or error logs.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils/mailer.php';

// Check if an email parameter is provided
$to = isset($_GET['to']) ? $_GET['to'] : '';

if (empty($to)) {
    echo "<h1>Gmail SMTP Email Test</h1>";
    echo "<p>Please provide a recipient email address in the URL query string.</p>";
    echo "<p>Example: <code>test_mail.php?to=your-email@example.com</code></p>";
    exit();
}

$subject = "Gmail SMTP Integration Test - Montage Auto Studio";
$htmlContent = "
    <h2>Test Email</h2>
    <p>This is a test email sent from <strong>Montage Auto Studio</strong> booking system using the new <strong>Gmail SMTP</strong> integration.</p>
    <p>If you received this email, the Gmail SMTP integration is working perfectly!</p>
    <hr>
    <p style='color: #777; font-size: 12px;'>Sent at: " . date('Y-m-d H:i:s') . "</p>
";

echo "<h1>Sending test email to " . htmlspecialchars($to) . "...</h1>";
$result = Mailer::send($to, $subject, $htmlContent);

if ($result) {
    echo "<p style='color: green; font-weight: bold;'>Success! The email was sent successfully.</p>";
} else {
    echo "<p style='color: red; font-weight: bold;'>Failed! Check the PHP error logs for detailed error output.</p>";
}
