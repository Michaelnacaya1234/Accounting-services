<?php
// api/reset-password.php
// Finalizes password reset: verifies a code and updates the password

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$resp = ['ok' => false, 'message' => 'unknown error'];

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    throw new RuntimeException('Method not allowed.');
  }

  // Load connection file
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

  // Obtain PDO instance
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

  // Parse JSON input
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) { $data = $_POST; }

  // Expect a stateless token and code; email/username optional
  $email = isset($data['email']) ? trim((string)$data['email']) : '';
  $username = isset($data['username']) ? trim((string)$data['username']) : '';
  // Token from multiple aliases
  $token = '';
  $tokenAliases = ['token','reset_token','resetToken','t'];
  foreach ($tokenAliases as $k) { if ($token === '' && isset($data[$k])) { $token = trim((string)$data[$k]); } }
  // Code from multiple aliases
  $code = '';
  $codeAliases = ['code','otp','reset_code','verification_code','verificationCode','c'];
  foreach ($codeAliases as $k) { if ($code === '' && isset($data[$k])) { $code = trim((string)$data[$k]); } }
  // Password from multiple aliases
  $password = '';
  $passwordAliases = ['password','new_password','newPassword','pass'];
  foreach ($passwordAliases as $k) { if ($password === '' && isset($data[$k])) { $password = (string)$data[$k]; } }

  // Fallbacks: accept token/code from query string or headers
  if ($token === '' && isset($_GET['token'])) { $token = trim((string)$_GET['token']); }
  if ($token === '' && isset($_GET['reset_token'])) { $token = trim((string)$_GET['reset_token']); }
  if ($code === '' && isset($_GET['code'])) { $code = trim((string)$_GET['code']); }
  if ($code === '' && isset($_GET['otp'])) { $code = trim((string)$_GET['otp']); }
  // Support Authorization: Bearer <token>
  $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? (string)$_SERVER['HTTP_AUTHORIZATION'] : '';
  if ($token === '' && $auth !== '') {
    if (stripos($auth, 'Bearer ') === 0) {
      $maybe = trim(substr($auth, 7));
      if ($maybe !== '') { $token = $maybe; }
    }
  }
  // Support X-Reset-Token header
  if ($token === '' && isset($_SERVER['HTTP_X_RESET_TOKEN'])) {
    $maybe = trim((string)$_SERVER['HTTP_X_RESET_TOKEN']);
    if ($maybe !== '') { $token = $maybe; }
  }
  // Support X-Reset-Code header
  if ($code === '' && isset($_SERVER['HTTP_X_RESET_CODE'])) {
    $maybe = trim((string)$_SERVER['HTTP_X_RESET_CODE']);
    if ($maybe !== '') { $code = $maybe; }
  }

  if ($email === '' && $username === '') {
    http_response_code(400);
    throw new RuntimeException('Email is required.');
  }
  if ($password === '' || $token === '' || $code === '') {
    http_response_code(400);
    throw new RuntimeException('Token, code, and new password are required.');
  }

  // Verify stateless token (base64url payload.signature)
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) {
    http_response_code(400);
    throw new RuntimeException('Invalid token format.');
  }
  list($payloadB64, $sigB64) = $parts;
  $payloadJson = base64_decode(strtr($payloadB64, '-_', '+/')); // padding optional
  if ($payloadJson === false || $payloadJson === '') {
    http_response_code(400);
    throw new RuntimeException('Invalid token payload.');
  }
  $payload = json_decode($payloadJson, true);
  if (!is_array($payload) || !isset($payload['uid'], $payload['exp'], $payload['ch'])) {
    http_response_code(400);
    throw new RuntimeException('Malformed token.');
  }

  // Load secret from config (fallback default)
  $appSecret = '';
  try {
    $configPath = __DIR__ . DIRECTORY_SEPARATOR . 'email-config.php';
    $cfg = file_exists($configPath) ? require $configPath : [];
    $appSecret = isset($cfg['password_reset_secret']) ? (string)$cfg['password_reset_secret'] : '';
  } catch (Throwable $e) {}
  if ($appSecret === '') { $appSecret = 'change-this-secret-in-email-config-php'; }

  $sigRaw = hash_hmac('sha256', $payloadB64, $appSecret, true);
  $expectedSigB64 = rtrim(strtr(base64_encode($sigRaw), '+/', '-_'), '=');
  if (!hash_equals($expectedSigB64, $sigB64)) {
    http_response_code(400);
    throw new RuntimeException('Invalid token signature.');
  }
  if ((int)$payload['exp'] < time()) {
    http_response_code(400);
    throw new RuntimeException('Reset token has expired.');
  }

  // Verify code against hashed code in token
  if (!password_verify($code, (string)$payload['ch'])) {
    http_response_code(400);
    throw new RuntimeException('Invalid reset code.');
  }

  // Optional: cross-check email/username if provided
  $user = ['User_id' => (int)$payload['uid']];
  if ($email !== '' || $username !== '') {
    if ($email !== '') {
      $stmt = $pdo->prepare('SELECT User_id FROM tbluser WHERE User_id = :id AND Email = :e LIMIT 1');
      $stmt->execute([':id' => (int)$payload['uid'], ':e' => $email]);
    } else {
      $stmt = $pdo->prepare('SELECT User_id FROM tbluser WHERE User_id = :id AND Username = :u LIMIT 1');
      $stmt->execute([':id' => (int)$payload['uid'], ':u' => $username]);
    }
    $checkUser = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$checkUser) {
      http_response_code(400);
      throw new RuntimeException('Provided account details do not match the token.');
    }
  }

  // Note: Password reset code verification removed as tblpassword_resets is no longer used

  // Update password
  $hash = password_hash($password, PASSWORD_BCRYPT);
  $upd = $pdo->prepare('UPDATE tbluser SET Password = :p WHERE User_id = :id');
  $upd->execute([':p' => $hash, ':id' => (int)$user['User_id']]);

  // Stateless flow: nothing to update after password change

  $resp['ok'] = true;
  $resp['message'] = 'Password updated successfully';
  echo json_encode($resp);
} catch (Throwable $e) {
  if (!http_response_code()) { http_response_code(500); }
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  echo json_encode($resp);
}
