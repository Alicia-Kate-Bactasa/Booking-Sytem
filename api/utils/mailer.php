<?php
/**
 * Montage Auto Studio - Centralized Mailing Service
 * 
 * Supports sending reliable HTML emails via Resend's Web API (HTTPS) 
 * with a clean fallback to PHP's native mail() when no API key is configured.
 */

class Mailer {
    /**
     * Send email notification to client
     * 
     * @param string $to Recipient email address
     * @param string $subject Email subject line
     * @param string $htmlContent HTML body content
     * @return bool True if success, false on failure
     */
    public static function send($to, $subject, $htmlContent) {
        // Retrieve configurations (either defined constants or defaults)
        $apiKey = defined('RESEND_API_KEY') ? RESEND_API_KEY : '';
        $fromEmail = defined('MAIL_FROM_EMAIL') ? MAIL_FROM_EMAIL : 'no-reply@montageautostudio.com';
        $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'Montage Auto Studio';
        $replyTo = defined('MAIL_REPLY_TO') ? MAIL_REPLY_TO : 'support@montageautostudio.com';

        if (!empty($apiKey)) {
            // Send using Resend Web API via HTTPS cURL
            return self::sendViaResend($apiKey, $to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo);
        } else {
            // Fallback to native PHP mail()
            error_log("Mailer Info: Resend API key not configured. Falling back to native PHP mail().");
            return self::sendViaNativeMail($to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo);
        }
    }

    /**
     * Send email via Resend Web API (Port 443 / HTTPS)
     */
    private static function sendViaResend($apiKey, $to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo) {
        $url = 'https://api.resend.com/emails';
        
        $payload = [
            'from' => "{$fromName} <{$fromEmail}>",
            'to' => [$to],
            'subject' => $subject,
            'html' => $htmlContent,
            'reply_to' => $replyTo
        ];

        $jsonData = json_encode($payload);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("Resend API Connection Error: " . $error);
            return false;
        }

        // Resend returns 200 OK or 201 Created on success
        if ($httpCode >= 200 && $httpCode < 300) {
            log_mail_event("Email successfully dispatched via Resend API to: {$to}");
            return true;
        } else {
            error_log("Resend API returned error code {$httpCode}. Response: " . $response);
            return false;
        }
    }

    /**
     * Fallback method using PHP's native mail() function
     */
    private static function sendViaNativeMail($to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo) {
        $headers = "MIME-Version: 1.0\r\n" .
                   "Content-type: text/html; charset=UTF-8\r\n" .
                   "From: {$fromName} <{$fromEmail}>\r\n" .
                   "Reply-To: {$replyTo}\r\n" .
                   "X-Mailer: PHP/" . phpversion();

        // Strip HTML wrapper tags for a raw alternative text representation (optional but good practice)
        $result = @mail($to, $subject, $htmlContent, $headers);
        if ($result) {
            log_mail_event("Email successfully dispatched via native mail() to: {$to}");
            return true;
        } else {
            error_log("Native PHP mail() failed to dispatch email to: {$to}");
            return false;
        }
    }
}

/**
 * Log email events gracefully
 */
function log_mail_event($msg) {
    // Print to PHP system error log
    error_log("Mailer Service Log: " . $msg);
}
