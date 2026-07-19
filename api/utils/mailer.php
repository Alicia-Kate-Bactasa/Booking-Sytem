<?php
/**
 * File: api/utils/mailer.php
 * Purpose: Centralized Mailing Service (Gmail SMTP / Brevo SMTP API / native PHP mail fallback).
 *          Handles preparation of premium HTML invoice templates and sends them out.
 *          Highlights the Booking Reference ID block in the body of the invoice if present.
 */

class Mailer {
    /**
     * Generate a premium formal HTML invoice template
     * 
     * @param array $data Invoice details
     * @return string HTML string
     */
    public static function formatInvoice($data) {
        $title = htmlspecialchars($data['title']);
        $invoiceNo = htmlspecialchars($data['invoice_no']);
        $date = htmlspecialchars($data['date']);
        $clientName = htmlspecialchars($data['client_name']);
        $clientEmail = htmlspecialchars($data['client_email']);
        
        $statusBg = htmlspecialchars($data['status_bg']);
        $statusBorder = htmlspecialchars($data['status_border']);
        $statusColor = htmlspecialchars($data['status_color']);
        $statusLabel = htmlspecialchars($data['status_label']);
        $statusDetail = $data['status_detail'];
        
        $itemName = htmlspecialchars($data['item_name']);
        $itemSubtext = htmlspecialchars($data['item_subtext']);
        $itemPrice = number_format($data['item_price'], 2);
        
        $subtotal = number_format($data['subtotal'], 2);
        $totalDue = number_format($data['total_due'], 2);
        
        $discountRow = '';
        if (isset($data['discount']) && $data['discount'] > 0) {
            $discountStr = number_format($data['discount'], 2);
            $discountRow = "
                <tr>
                    <td style='color: #27ae60;'>Discount/VIP:</td>
                    <td style='text-align: right; font-weight: bold; color: #27ae60;'>-₱{$discountStr}</td>
                </tr>";
        }

        $bookingIdHighlight = '';
        if (isset($data['booking_id']) && !empty($data['booking_id'])) {
            $rawBookingId = $data['booking_id'];
            if (is_numeric($rawBookingId)) {
                $bookingRef = 'MTG-' . (int)$rawBookingId;
            } else {
                if (stripos($rawBookingId, 'MTG-') === 0) {
                    $bookingRef = $rawBookingId;
                } else {
                    $bookingRef = 'MTG-' . $rawBookingId;
                }
            }
            // Strip any leading zeros after the dash (e.g. MTG-007 -> MTG-7)
            $bookingRef = preg_replace('/^MTG-0+([1-9][0-9]*)$/i', 'MTG-$1', $bookingRef);
            $bookingIdHtml = htmlspecialchars($bookingRef);
            $bookingIdHighlight = "
            <!-- Booking ID Highlight Card -->
            <div style='background-color: #f8f9fa; border: 2px solid #111; padding: 15px; margin-bottom: 25px; border-radius: 8px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);'>
                <span style='font-size: 10px; text-transform: uppercase; color: #777; font-weight: bold; letter-spacing: 2px; display: block; margin-bottom: 5px;'>Booking Reference</span>
                <strong style='font-size: 24px; color: #111; font-family: monospace; letter-spacing: 0.5px;'>{$bookingIdHtml}</strong>
            </div>";
        }

        return "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); color: #333;'>
            <!-- Header -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px;'>
                <tr>
                    <td>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='margin: 5px 0 0 0; color: #111; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;'>{$title}</h2>
                    </td>
                    <td style='text-align: right; vertical-align: top;'>
                        <span style='font-size: 11px; color: #777; display: block;'>Invoice No: <strong>{$invoiceNo}</strong></span>
                        <span style='font-size: 11px; color: #777; display: block;'>Date: <strong>{$date}</strong></span>
                    </td>
                </tr>
            </table>
            
            <!-- Billing Details -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; line-height: 1.5;'>
                <tr>
                    <td style='width: 50%; padding-right: 15px; vertical-align: top;'>
                        <span style='font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999; display: block; margin-bottom: 5px;'>Billed To:</span>
                        <strong>{$clientName}</strong><br>
                        Email: {$clientEmail}<br>
                    </td>
                    <td style='width: 50%; padding-left: 15px; vertical-align: top;'>
                        <span style='font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999; display: block; margin-bottom: 5px;'>From:</span>
                        <strong>Montage Auto Studio</strong><br>
                        Near Mango Green Village,<br>
                        Banilad, Mandaue City, Cebu, Philippines
                    </td>
                </tr>
            </table>

            <!-- Status Banner -->
            <div style='background-color: {$statusBg}; border-left: 4px solid {$statusBorder}; padding: 12px; margin-bottom: 25px; border-radius: 4px; font-size: 13px; color: {$statusColor};'>
                <strong>Status: {$statusLabel}</strong><br>
                {$statusDetail}
            </div>

            {$bookingIdHighlight}

            <!-- Items Table -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;'>
                <thead>
                    <tr style='border-bottom: 2px solid #eee; text-align: left;'>
                        <th style='padding: 10px 5px; color: #666; font-weight: bold;'>Description</th>
                        <th style='padding: 10px 5px; color: #666; font-weight: bold; text-align: center; width: 60px;'>Qty</th>
                        <th style='padding: 10px 5px; color: #666; font-weight: bold; text-align: right; width: 100px;'>Price</th>
                        <th style='padding: 10px 5px; color: #666; font-weight: bold; text-align: right; width: 100px;'>Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style='border-bottom: 1px solid #f9f9f9;'>
                        <td style='padding: 12px 5px;'>
                            <strong>{$itemName}</strong><br>
                            <span style='font-size: 11px; color: #777;'>{$itemSubtext}</span>
                        </td>
                        <td style='padding: 12px 5px; text-align: center;'>1</td>
                        <td style='padding: 12px 5px; text-align: right;'>₱{$itemPrice}</td>
                        <td style='padding: 12px 5px; text-align: right;'>₱{$itemPrice}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Calculations -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;'>
                <tr>
                    <td style='width: 50%;'></td>
                    <td style='width: 50%;'>
                        <table style='width: 100%; border-collapse: collapse; line-height: 2;'>
                            <tr>
                                <td style='color: #666;'>Subtotal:</td>
                                <td style='text-align: right; font-weight: bold;'>₱{$subtotal}</td>
                            </tr>
                            {$discountRow}
                            <tr style='border-top: 1px solid #ddd;'>
                                <td style='font-weight: bold; color: #111; font-size: 14px; padding-top: 5px;'>Total Due:</td>
                                <td style='text-align: right; font-weight: 900; color: #111; font-size: 16px; padding-top: 5px;'>₱{$totalDue}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Footer -->
            <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
            <p style='font-size: 11px; color: #888; text-align: center; margin: 0;'>
                Thank you for choosing Montage Auto Studio! For questions, email support@montageautostudio.com.
            </p>
        </div>";
    }

    /**
     * Generate a premium formal HTML email notification template (non-invoice)
     * 
     * @param array $data Notification details
     * @return string HTML string
     */
    public static function formatNotification($data) {
        $title = htmlspecialchars($data['title']);
        $date = htmlspecialchars($data['date']);
        $clientName = htmlspecialchars($data['client_name']);
        
        $statusBg = htmlspecialchars($data['status_bg']);
        $statusBorder = htmlspecialchars($data['status_border']);
        $statusColor = htmlspecialchars($data['status_color']);
        $statusLabel = htmlspecialchars($data['status_label']);
        $statusDetail = $data['status_detail'];
        
        $buttonHtml = isset($data['button_html']) ? $data['button_html'] : '';

        return "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); color: #333;'>
            <!-- Header -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px;'>
                <tr>
                    <td>
                        <span style='font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #999; text-transform: uppercase;'>Montage Auto Studio</span>
                        <h2 style='margin: 5px 0 0 0; color: #111; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;'>{$title}</h2>
                    </td>
                    <td style='text-align: right; vertical-align: top;'>
                        <span style='font-size: 11px; color: #777; display: block;'>Date: <strong>{$date}</strong></span>
                    </td>
                </tr>
            </table>
            
            <!-- Recipient Details -->
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; line-height: 1.5;'>
                <tr>
                    <td style='vertical-align: top;'>
                        <span style='font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999; display: block; margin-bottom: 5px;'>Recipient:</span>
                        <strong>{$clientName}</strong>
                    </td>
                </tr>
            </table>

            <!-- Status Banner -->
            <div style='background-color: {$statusBg}; border-left: 4px solid {$statusBorder}; padding: 18px; margin-bottom: 25px; border-radius: 8px; font-size: 13px; color: {$statusColor}; line-height: 1.6;'>
                <strong style='font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;'>{$statusLabel}</strong><br><br>
                {$statusDetail}
                " . (!empty($buttonHtml) ? "<div style='margin-top: 18px;'>{$buttonHtml}</div>" : "") . "
            </div>

            <!-- Footer -->
            <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
            <p style='font-size: 11px; color: #888; text-align: center; margin: 0;'>
                If you did not request this email, you can safely ignore it.<br><br>
                Thank you, <br><strong>Montage Auto Studio Team</strong>
            </p>
        </div>";
    }

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
        $brevoKey = defined('BREVO_API_KEY') ? BREVO_API_KEY : '';
        $fromEmail = defined('MAIL_FROM_EMAIL') ? MAIL_FROM_EMAIL : 'bactasa.ak@gmail.com';
        $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'Montage Auto Studio';
        $replyTo = defined('MAIL_REPLY_TO') ? MAIL_REPLY_TO : 'support@montageautostudio.com';

        // Check if Gmail SMTP is configured
        if (defined('SMTP_USER') && !empty(SMTP_USER) && defined('SMTP_PASS') && !empty(SMTP_PASS)) {
            return self::sendViaSMTP($to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo);
        } elseif (!empty($brevoKey)) {
            // Send using Brevo Web API (allows personal verified senders like Gmail)
            return self::sendViaBrevo($brevoKey, $to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo);
        } else {
            // Fallback to native PHP mail()
            error_log("Mailer Info: No SMTP credentials or Brevo API key configured. Falling back to native PHP mail().");
            return self::sendViaNativeMail($to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo);
        }
    }

    /**
     * Send email via Gmail / custom SMTP using PHPMailer
     */
    private static function sendViaSMTP($to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo) {
        require_once __DIR__ . '/PHPMailer/Exception.php';
        require_once __DIR__ . '/PHPMailer/PHPMailer.php';
        require_once __DIR__ . '/PHPMailer/SMTP.php';

        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);

        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host       = defined('SMTP_HOST') ? SMTP_HOST : 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = SMTP_USER;
            $mail->Password   = SMTP_PASS;
            
            $secure = defined('SMTP_SECURE') ? SMTP_SECURE : 'tls';
            if ($secure === 'ssl') {
                $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
                $mail->Port       = defined('SMTP_PORT') ? SMTP_PORT : 465;
            } else {
                $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = defined('SMTP_PORT') ? SMTP_PORT : 587;
            }

            // Recipients
            // Gmail requires From address to match SMTP Username
            $mail->setFrom(SMTP_USER, $fromName);
            $mail->addAddress($to);
            $mail->addReplyTo($replyTo);

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlContent;

            $mail->send();
            log_mail_event("Email successfully dispatched via SMTP to: {$to}");
            return true;
        } catch (\Exception $e) {
            error_log("SMTP Mailer Error: {$mail->ErrorInfo}");
            return false;
        }
    }

    /**
     * Send email via Brevo SMTP API (Port 443 / HTTPS)
     */
    private static function sendViaBrevo($apiKey, $to, $subject, $htmlContent, $fromEmail, $fromName, $replyTo) {
        $url = 'https://api.brevo.com/v3/smtp/email';
        
        $payload = [
            'sender' => [
                'name' => $fromName,
                'email' => $fromEmail
            ],
            'to' => [
                ['email' => $to]
            ],
            'subject' => $subject,
            'htmlContent' => $htmlContent,
            'replyTo' => [
                'email' => $replyTo
            ]
        ];

        $jsonData = json_encode($payload);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'api-key: ' . $apiKey,
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
            error_log("Brevo API Connection Error: " . $error);
            return false;
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            log_mail_event("Email successfully dispatched via Brevo API to: {$to}");
            return true;
        } else {
            error_log("Brevo API returned error code {$httpCode}. Response: " . $response);
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
    error_log("Mailer Service Log: " . $msg);
}
?>
