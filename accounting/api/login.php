<?php
// api/login.php
// Validates username/password against `tbluser` using your PDO connection.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$resp = [ 'ok' => false, 'message' => 'unknown error' ];

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    throw new RuntimeException('Method not allowed. Use POST.');
  }

  // Read JSON or form body
  $raw = file_get_contents('php://input');
  $data = null;
  if ($raw) {
    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
      $data = $decoded;
    }
  }
  if (!is_array($data)) {
    // fallback to form
    $data = $_POST;
  }

  $identifier = '';
  if (isset($data['email'])) { $identifier = trim((string)$data['email']); }
  if ($identifier === '' && isset($data['username'])) { $identifier = trim((string)$data['username']); }
  $password = isset($data['password']) ? (string)$data['password'] : '';
  if ($identifier === '' || $password === '') {
    http_response_code(400);
    throw new RuntimeException('Email and password are required.');
  }

  // Resolve connection-pdo.php from either accounting/api or the project root api folder
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
    throw new RuntimeException('Missing connection-pdo.php. Tried: ' . implode(', ', $candidatePaths));
  }
  // Suppress output from connection-pdo.php
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
    // Use $conn from connection-pdo.php
    $pdoInstance = $conn;
  }
  if (!($pdoInstance instanceof PDO)) {
    // Fallback: try direct connection using connection-pdo.php defaults (DB: dbaccounting, user: root, pass: "")
    try {
      $pdoInstance = new PDO('mysql:host=localhost;dbname=dbaccounting;charset=utf8mb4', 'root', '');
    } catch (Throwable $e2) {
      // ignore and throw below
    }
  }
  if (!($pdoInstance instanceof PDO)) {
    http_response_code(500);
    throw new RuntimeException('Could not obtain PDO connection from connection-pdo.php or fallback DSN.');
  }
  $pdo = $pdoInstance;
  try { $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); } catch (Throwable $e) {}

  // Query user by email (preferred) or username (fallback)
  if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
    // Accept either Email or Username matching the given email string to support legacy admin seeding
    $stmt = $pdo->prepare('SELECT u.User_id, u.Username, u.Password, u.Role_id, u.Email, u.Client_id, c.Status_id FROM tbluser u LEFT JOIN tblclient c ON c.Client_ID = u.Client_id WHERE (u.Email = :id OR u.Username = :id) LIMIT 1');
  } else {
    $stmt = $pdo->prepare('SELECT u.User_id, u.Username, u.Password, u.Role_id, u.Email, u.Client_id, c.Status_id FROM tbluser u LEFT JOIN tblclient c ON c.Client_ID = u.Client_id WHERE (u.Username = :id OR u.Email = :id) LIMIT 1');
  }
  $stmt->execute([':id' => $identifier]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    http_response_code(401);
    throw new RuntimeException('Invalid email or password.');
  }

  $hash = (string)$row['Password'];
  $valid = password_verify($password, $hash);
  if (!$valid) {
    // As a safety net, allow exact match if legacy DB stored plaintext (not recommended)
    if (hash_equals($hash, $password)) {
      $valid = true;
    }
  }

  if (!$valid) {
    http_response_code(401);
    throw new RuntimeException('Invalid email or password.');
  }

  // Enforce approval only for users linked to a client record (admins are exempt)
  $roleId = isset($row['Role_id']) ? (int)$row['Role_id'] : null;
  $clientId = isset($row['Client_id']) ? (int)$row['Client_id'] : null;
  $statusId = isset($row['Status_id']) ? $row['Status_id'] : null;
  if ($clientId !== null && (string)$statusId !== '1') {
    http_response_code(403);
    throw new RuntimeException('Your account is pending approval. Please wait for an administrator to approve your account.');
  }

  $resp['ok'] = true;
  $resp['message'] = 'Authenticated';
  $resp['user'] = [
    'user_id' => (int)$row['User_id'],
    'username' => $row['Username'],
    'role_id' => isset($row['Role_id']) ? (int)$row['Role_id'] : null,
    'email' => $row['Email'],
    'client_id' => isset($row['Client_id']) ? (int)$row['Client_id'] : null,
    'client_status' => isset($row['Status_id']) ? (is_null($row['Status_id']) ? null : (int)$row['Status_id']) : null,
  ];
  echo json_encode($resp);
} catch (Throwable $e) {
  if (!http_response_code()) { http_response_code(500); }
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  echo json_encode($resp);
}
