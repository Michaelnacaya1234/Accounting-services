<?php
// api/approve-client.php
// Approve client and send email notification

// Suppress any output that might break JSON response
error_reporting(E_ALL);
ini_set('display_errors', 0);
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$resp = ['ok' => false, 'message' => 'unknown error'];

try {
  // Clear any previous output
  ob_clean();
  // Resolve connection-pdo.php
  $candidatePaths = [
    __DIR__ . DIRECTORY_SEPARATOR . 'connection-pdo.php',
    dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'connection-pdo.php',
  ];
  $foundPath = null;
  foreach ($candidatePaths as $p) {
    if (is_file($p)) {
      $foundPath = $p;
      break;
    }
  }
  if (!$foundPath) {
    http_response_code(500);
    throw new RuntimeException('Missing connection-pdo.php. Tried: ' . implode(', ', $candidatePaths));
  }
  
  ob_start();
  require_once $foundPath;
  ob_end_clean();

  // Obtain PDO
  $pdoInstance = null;
  if (isset($pdo) && $pdo instanceof PDO) {
    $pdoInstance = $pdo;
  } elseif (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
    $pdoInstance = $GLOBALS['pdo'];
  } elseif (function_exists('getPDO') && is_callable('getPDO')) {
    $pdoInstance = call_user_func('getPDO');
  } elseif (isset($conn) && $conn instanceof PDO) {
    $pdoInstance = $conn;
  }
  
  if (!($pdoInstance instanceof PDO)) {
    try {
      $pdoInstance = new PDO('mysql:host=localhost;dbname=dbaccounting;charset=utf8mb4', 'root', '');
    } catch (Throwable $e2) {
      // ignore
    }
  }
  
  if (!($pdoInstance instanceof PDO)) {
    http_response_code(500);
    throw new RuntimeException('Could not obtain PDO connection.');
  }
  
  $pdo = $pdoInstance;
  try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  } catch (Throwable $e) {}

  // Load PHPMailer
  $phpmailerPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'PHPMailer-master' . DIRECTORY_SEPARATOR . 'src';
  
  if (!file_exists($phpmailerPath . DIRECTORY_SEPARATOR . 'Exception.php')) {
    throw new RuntimeException('PHPMailer Exception.php not found at: ' . $phpmailerPath);
  }
  
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'Exception.php';
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'PHPMailer.php';
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'SMTP.php';

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    throw new RuntimeException('Method not allowed.');
  }

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  
  if (!is_array($data)) {
    $data = $_POST;
  }
  
  $user_id = isset($data['user_id']) ? (int)$data['user_id'] : 0;
  
  if ($user_id === 0) {
    http_response_code(400);
    throw new RuntimeException('User ID is required.');
  }
  
  // Get user and client information
  $stmt = $pdo->prepare("
    SELECT 
      u.User_id,
      u.Username,
      u.Email AS user_email,
      u.Client_id,
      c.Client_ID,
      c.Email AS client_email,
      c.First_name,
      c.Middle_name,
      c.Last_name,
      c.Status_id
    FROM tbluser u
    LEFT JOIN tblclient c ON c.Client_ID = u.Client_id
    WHERE u.User_id = :user_id
    LIMIT 1
  ");
  $stmt->execute([':user_id' => $user_id]);
  $userData = $stmt->fetch(PDO::FETCH_ASSOC);
  
  if (!$userData) {
    http_response_code(404);
    throw new RuntimeException('User not found.');
  }
  
  if (!$userData['Client_ID']) {
    http_response_code(400);
    throw new RuntimeException('User does not have an associated client record.');
  }
  
  // Update client status to Active (Status_id = 1)
  $updateStmt = $pdo->prepare('UPDATE tblclient SET Status_id = 1 WHERE Client_ID = :client_id');
  $updateStmt->execute([':client_id' => $userData['Client_ID']]);
  
  // Get email address (prefer client email, fallback to user email)
  $recipientEmail = $userData['client_email'] ?: $userData['user_email'];
  
  if (empty($recipientEmail)) {
    $resp['ok'] = true;
    $resp['message'] = 'Client approved successfully, but no email address found to send notification.';
    ob_clean();
    echo json_encode($resp);
    ob_end_flush();
    exit;
  }
  
  // Get client name
  $clientName = trim(($userData['First_name'] ?? '') . ' ' . ($userData['Middle_name'] ?? '') . ' ' . ($userData['Last_name'] ?? ''));
  if (empty($clientName)) {
    $clientName = $userData['Username'];
  }
  
  // Send approval email using PHPMailer
  $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
  
  try {
    // Load email configuration if available
    $emailConfigPath = __DIR__ . DIRECTORY_SEPARATOR . 'email-config.php';
    $emailConfig = null;
    if (file_exists($emailConfigPath)) {
      $emailConfig = require $emailConfigPath;
    }
    
    // Server settings for Gmail
    $mail->isSMTP();
    $mail->Host       = $emailConfig['smtp_host'] ?? 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = $emailConfig['smtp_username'] ?? 'your-email@gmail.com';
    $mail->Password   = $emailConfig['smtp_password'] ?? 'your-app-password';
    $mail->SMTPSecure = ($emailConfig['smtp_secure'] ?? 'tls') === 'ssl' ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $emailConfig['smtp_port'] ?? 587;
    $mail->CharSet    = 'UTF-8';
    
    // Recipients
    $fromEmail = $emailConfig['from_email'] ?? 'your-email@gmail.com';
    $fromName = $emailConfig['from_name'] ?? 'Accounting Services';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($recipientEmail, $clientName);
    
    // Content
    $mail->isHTML(true);
    $mail->Subject = 'Your Account Has Been Approved';
    
    // Get login URL
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
              (isset($_SERVER['HTTP_HOST']) ? 'http://' . $_SERVER['HTTP_HOST'] : 'http://localhost/Accounting');
    $loginUrl = $origin . 'http://localhost:3000/#/';
    
$mail->Body = "
<html>
<head>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header { 
          background-color: #2563eb; 
          color: #ffffff; 
          padding: 20px 30px; 
          text-align: center; 
          border-radius: 10px 10px 0 0;
        }
    .content {
      padding: 30px;
      color: #333;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      transition: 0.3s;
    }
    .button:hover {
      background-color: #1976D2;
    }
    .footer {
      font-size: 12px;
      color: #666;
      text-align: center;
      padding: 20px;
      border-top: 1px solid #eee;
      background-color: #fafafa;
    }
  </style>
</head>
<body>
  <div class='container'>
    <div class='header'>
      <h2>Account Approval Confirmation</h2>
    </div>
    <div class='content'>
      <p>Dear " . htmlspecialchars($clientName) . ",</p>

      <p>We are pleased to inform you that your account registration with the <strong>Accounting Management System</strong> has been successfully <strong>approved</strong>.</p>

      <p>You may now log in to your account using the credentials you provided during registration.</p>

      <ul>
        <li><strong>Username:</strong> " . htmlspecialchars($recipientEmail) . "</li>
      </ul>

      <p style='text-align: center;'>
        <a href='" . htmlspecialchars($loginUrl) . "' class='button'>Access Your Dashboard</a>
      </p>

      <p>If you encounter any issues while logging in, please don’t hesitate to contact our support team for assistance.</p>

      <p>Thank you for choosing our system. We look forward to supporting your accounting needs.</p>

      <p>Kind regards,<br><strong>Accounting System Administrator</strong></p>
    </div>
    <div class='footer'>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
";

    
    $mail->AltBody = "Dear " . $clientName . ",\n\n" .
                     "We are pleased to inform you that your account has been approved!\n\n" .
                     "You can now log in to your client dashboard using your credentials:\n" .
                     "Email: " . $recipientEmail . "\n\n" .
                     "Login URL: " . $loginUrl . "\n\n" .
                     "If you have any questions or need assistance, please don't hesitate to contact us.\n\n" .
                     "Best regards,\nAccounting System Team";
    
    $mail->send();
    
    $resp['ok'] = true;
    $resp['message'] = 'Client approved successfully and approval email sent.';
  } catch (\PHPMailer\PHPMailer\Exception $e) {
    // Email failed, but approval was successful
    $resp['ok'] = true;
    $resp['message'] = 'Client approved successfully, but email could not be sent: ' . $mail->ErrorInfo;
  }
  
  // Ensure no output before JSON
  ob_clean();
  echo json_encode($resp);
  ob_end_flush();
} catch (Throwable $e) {
  // Clear any output
  ob_clean();
  if (!http_response_code()) {
    http_response_code(500);
  }
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  // Log error for debugging (remove in production or use proper logging)
  error_log('Approve Client Error: ' . $e->getMessage() . ' | Trace: ' . $e->getTraceAsString());
  echo json_encode($resp);
  ob_end_flush();
}

