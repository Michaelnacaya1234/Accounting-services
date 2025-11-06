<?php
// api/request-reset.php
// Generates a one-time password reset code and emails it via PHPMailer

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
  // Clean any buffered output
  ob_clean();

  // Resolve DB connection
  $candidatePaths = [
    __DIR__ . DIRECTORY_SEPARATOR . 'connection-pdo.php',
    dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'connection-pdo.php',
  ];
  $foundPath = null;
  foreach ($candidatePaths as $p) {
    if (is_file($p)) { $foundPath = $p; break; }
  }
  if (!$foundPath) {
    http_response_code(500);
    throw new RuntimeException('Missing connection-pdo.php.');
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
    try { $pdoInstance = new PDO('mysql:host=localhost;dbname=dbaccounting;charset=utf8mb4', 'root', ''); } catch (Throwable $e2) {}
  }
  if (!($pdoInstance instanceof PDO)) {
    http_response_code(500);
    throw new RuntimeException('Could not obtain PDO connection.');
  }
  $pdo = $pdoInstance;
  try { $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); } catch (Throwable $e) {}

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    throw new RuntimeException('Method not allowed.');
  }

  // Parse input
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) { $data = $_POST; }

  // Now use email as the primary identifier (fallback to username only if email missing)
  $email = isset($data['email']) ? trim((string)$data['email']) : '';
  $username = isset($data['username']) ? trim((string)$data['username']) : '';

  if ($email === '' && $username === '') {
    http_response_code(400);
    throw new RuntimeException('Email is required.');
  }

  // Find user by email first, fallback to username for backward compatibility
  $user = null;
  if ($email !== '') {
    $stmt = $pdo->prepare('SELECT User_id, Username, Email, Client_id FROM tbluser WHERE Email = :e LIMIT 1');
    $stmt->execute([':e' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
  } else {
    $stmt = $pdo->prepare('SELECT User_id, Username, Email, Client_id FROM tbluser WHERE Username = :u LIMIT 1');
    $stmt->execute([':u' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
  }

  if (!$user) {
    // For privacy, do not reveal user existence. Simulate success.
    $resp['ok'] = true;
    $resp['message'] = 'If the account exists, a code has been sent.';
    ob_clean();
    echo json_encode($resp);
    ob_end_flush();
    exit;
  }

  // Determine recipient email
  $recipientEmail = $user['Email'] ?? '';

  // If user email missing, try to use client email if available
  if (empty($recipientEmail) && !empty($user['Client_id'])) {
    try {
      $cstmt = $pdo->prepare('SELECT Email FROM tblclient WHERE Client_ID = :cid LIMIT 1');
      $cstmt->execute([':cid' => (int)$user['Client_id']]);
      $c = $cstmt->fetch(PDO::FETCH_ASSOC);
      if ($c && !empty($c['Email'])) {
        $recipientEmail = $c['Email'];
      }
    } catch (Throwable $e) {
      // ignore
    }
  }

  // If still missing, fallback to provided email (if any)
  if (empty($recipientEmail) && $email !== '') {
    $recipientEmail = $email;
  }

  if (empty($recipientEmail)) {
    http_response_code(400);
    throw new RuntimeException('No email address on file for this user.');
  }

  // Optional: if an email was provided and stored email exists and differs, reject
  if ($email !== '' && !empty($user['Email']) && strcasecmp($email, $user['Email']) !== 0) {
    http_response_code(400);
    throw new RuntimeException('Provided email does not match this account.');
  }

  // Stateless password reset token (no database table required)
  // Generate a 6-digit code and sign a token that includes user id, expiry, and code hash
  try { $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT); }
  catch (Throwable $e) { $code = str_pad((string)mt_rand(0, 999999), 6, '0', STR_PAD_LEFT); }

  $minutesValid = 10;
  $expiresAt = time() + ($minutesValid * 60);
  $codeHash = password_hash($code, PASSWORD_BCRYPT);

  // Secret for HMAC signature; prefer config, fallback to a default
  $appSecret = '';
  try {
    $configPath = __DIR__ . DIRECTORY_SEPARATOR . 'email-config.php';
    $cfg = file_exists($configPath) ? require $configPath : [];
    $appSecret = isset($cfg['password_reset_secret']) ? (string)$cfg['password_reset_secret'] : '';
  } catch (Throwable $e) {}
  if ($appSecret === '') { $appSecret = 'change-this-secret-in-email-config-php'; }

  // Create compact payload and signature (base64url)
  $payloadArr = [
    'uid' => (int)$user['User_id'],
    'exp' => $expiresAt,
    'ch'  => $codeHash,
  ];
  $payloadJson = json_encode($payloadArr, JSON_UNESCAPED_SLASHES);
  $payloadB64 = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');
  $sigRaw = hash_hmac('sha256', $payloadB64, $appSecret, true);
  $sigB64 = rtrim(strtr(base64_encode($sigRaw), '+/', '-_'), '=');
  $token = $payloadB64 . '.' . $sigB64;

  // Load PHPMailer
  $phpmailerPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'PHPMailer-master' . DIRECTORY_SEPARATOR . 'src';
  if (!file_exists($phpmailerPath . DIRECTORY_SEPARATOR . 'Exception.php')) {
    throw new RuntimeException('PHPMailer Exception.php not found at: ' . $phpmailerPath);
  }
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'Exception.php';
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'PHPMailer.php';
  require_once $phpmailerPath . DIRECTORY_SEPARATOR . 'SMTP.php';

  // Send email
  $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
  $emailConfigPath = __DIR__ . DIRECTORY_SEPARATOR . 'email-config.php';
  $emailConfig = file_exists($emailConfigPath) ? require $emailConfigPath : [];

  try {
    $mail->isSMTP();
    $mail->Host       = $emailConfig['smtp_host'] ?? 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = $emailConfig['smtp_username'] ?? 'your-email@gmail.com';
    $mail->Password   = $emailConfig['smtp_password'] ?? 'your-app-password';
    $mail->SMTPSecure = ($emailConfig['smtp_secure'] ?? 'tls') === 'ssl' ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $emailConfig['smtp_port'] ?? 587;
    $mail->CharSet    = 'UTF-8';

    $fromEmail = $emailConfig['from_email'] ?? 'your-email@gmail.com';
    $fromName  = $emailConfig['from_name'] ?? 'Accounting System';

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($recipientEmail, $user['Username'] ?? '');

    $mail->isHTML(true);
  $mail->Subject = 'Password reset request';

    // Build frontend reset URL with token (if frontend exists)
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : (isset($_SERVER['HTTP_HOST']) ? 'http://' . $_SERVER['HTTP_HOST'] : 'http://localhost/Accounting');
    $resetUrl = $origin . '/accounting/#/reset-password?token=' . urlencode($token);

    $mail->Body = "
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; }
          .container { max-width: 560px; margin: 0 auto; padding: 24px; }
          .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
          .code { font-size: 28px; letter-spacing: 8px; font-weight: 700; background: #f1f5f9; color: #111827; padding: 12px 16px; border-radius: 10px; text-align: center; }
          .muted { color: #64748b; font-size: 14px; }
          .button { display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class='container'>
          <div class='card'>
            <h2>Password Reset Code</h2>
            <p>Use the code below to reset your password. This code will expire in <strong>{$minutesValid} minutes</strong>.</p>
            <p class='code'>" . htmlspecialchars($code) . "</p>
            <p>You can also open the reset page directly:</p>
            <p><a class='button' href='" . htmlspecialchars($resetUrl) . "'>Open Reset Page</a></p>
            <p class='muted'>If you did not request this, you can ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    ";

    $mail->AltBody = "Your password reset code is: " . $code . "\nThis code expires in {$minutesValid} minutes.\nOpen reset page: " . $resetUrl;

    $mail->send();
  } catch (\PHPMailer\PHPMailer\Exception $e) {
    http_response_code(500);
    throw new RuntimeException('Could not send email: ' . $mail->ErrorInfo);
  }

  $resp['ok'] = true;
  $resp['message'] = 'If the account exists, a code has been sent.';
  // Return token for the client app to include with the code when resetting
  $resp['token'] = $token;
  ob_clean();
  echo json_encode($resp);
  ob_end_flush();
} catch (Throwable $e) {
  ob_clean();
  if (!http_response_code()) { http_response_code(500); }
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  echo json_encode($resp);
  ob_end_flush();
}
