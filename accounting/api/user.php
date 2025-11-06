<?php
// api/user.php
// Creates an admin account (username: admin, password: admin123) in the `tbluser` table.
// Uses your existing PDO connection from api/connection-pdo.php (root or accounting/api).

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$resp = [ 'ok' => false, 'message' => 'unknown error' ];

try {
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
    throw new RuntimeException('Missing connection-pdo.php. Tried: ' . implode(', ', $candidatePaths));
  }
  require_once $foundPath;

  // Resolve a PDO instance from your connection file.
  $pdoInstance = null;
  if (isset($pdo) && $pdo instanceof PDO) {
    $pdoInstance = $pdo;
  } elseif (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
    $pdoInstance = $GLOBALS['pdo'];
  } elseif (function_exists('getPDO') && is_callable('getPDO')) {
    $pdoInstance = call_user_func('getPDO');
  }
  if (!($pdoInstance instanceof PDO)) {
    // Fallback: try direct connection using database.sql defaults (DB: accounting, user: root, pass: "")
    try {
      $pdoInstance = new PDO('mysql:host=localhost;dbname=accounting;charset=utf8mb4', 'root', '');
    } catch (Throwable $e2) {
      // ignore and throw below
    }
  }
  if (!($pdoInstance instanceof PDO)) {
    throw new RuntimeException('Could not obtain PDO connection from connection-pdo.php or fallback DSN. Define $pdo or a getPDO() function that returns a PDO instance.');
  }
  $pdo = $pdoInstance;

  // Optional: tighten error reporting for clearer messages
  try { $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); } catch (Throwable $e) {}

  $username = 'admin@gmail.com';
  $passwordPlain = 'admin123';

  // Check if user already exists
  $stmt = $pdo->prepare('SELECT User_id FROM tbluser WHERE Username = :u LIMIT 1');
  $stmt->execute([':u' => $username]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existing) {
    // Reset admin password to the required default and ensure admin role
    $hash = password_hash($passwordPlain, PASSWORD_BCRYPT);
    $upd = $pdo->prepare('UPDATE tbluser SET Password = :p, Role_id = COALESCE(Role_id, 1) WHERE User_id = :id');
    $upd->execute([
      ':p' => $hash,
      ':id' => $existing['User_id'],
    ]);
    $resp['ok'] = true;
    $resp['message'] = 'Admin account password reset to admin123.';
    $resp['user_id'] = (int)$existing['User_id'];
  } else {
    // Insert admin with a secure hash
    $hash = password_hash($passwordPlain, PASSWORD_BCRYPT);

    $ins = $pdo->prepare('INSERT INTO tbluser (Username, Password, Role_id, Email) VALUES (:u, :p, :r, :e)');
    $ins->execute([
      ':u' => $username,
      ':p' => $hash,
      ':r' => 1,         // assuming 1 = admin; adjust if your roles differ
      ':e' => null,
    ]);

    $resp['ok'] = true;
    $resp['message'] = 'Admin account created.';
    $resp['user_id'] = (int)$pdo->lastInsertId();
  }

  echo json_encode($resp);
} catch (Throwable $e) {
  http_response_code(500);
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  echo json_encode($resp);
}
