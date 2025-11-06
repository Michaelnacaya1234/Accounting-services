<?php
// api/employees.php
// CRUD operations for employee/user management

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$resp = ['ok' => false, 'message' => 'unknown error'];

try {
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

  // Ensure Submitted timestamp exists for users
  try {
    $pdo->exec("ALTER TABLE tbluser ADD COLUMN IF NOT EXISTS Created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  } catch (Throwable $e) {}

  $method = $_SERVER['REQUEST_METHOD'];

  // GET - List all employees
  if ($method === 'GET') {
    // Join with client and latest business to provide display fields
    $sql = "
      SELECT
        u.User_id,
        u.Username,
        u.Email,
        u.Role_id,
        u.Client_id,
        b.Business_name,
        TRIM(CONCAT(COALESCE(c.First_name,''),
                    CASE WHEN c.Middle_name IS NOT NULL AND c.Middle_name <> '' THEN CONCAT(' ', c.Middle_name) ELSE '' END,
                    CASE WHEN c.Last_name IS NOT NULL AND c.Last_name <> '' THEN CONCAT(' ', c.Last_name) ELSE '' END)) AS Owner_name,
        CASE
          WHEN c.Status_id IS NULL THEN 'Pending'
          WHEN c.Status_id = 1 THEN 'Active'
          WHEN c.Status_id = 2 THEN 'Inactive'
          ELSE CONCAT('Status #', c.Status_id)
        END AS Status,
        u.Created_at AS Submitted,
        b.Business_permit,
        b.SPA,
        b.DTI
      FROM tbluser u
      LEFT JOIN tblclient c ON c.Client_ID = u.Client_id
      LEFT JOIN (
        SELECT tb.Business_id, tb.User_id, tb.Business_name, tb.Business_permit, tb.SPA, tb.DTI
        FROM tblbusiness tb
        INNER JOIN (
          SELECT User_id, MAX(Business_id) AS max_id FROM tblbusiness GROUP BY User_id
        ) tmax ON tmax.User_id = tb.User_id AND tmax.max_id = tb.Business_id
      ) b ON b.User_id = u.User_id
      WHERE u.Client_id IS NOT NULL AND (u.Role_id IS NULL OR u.Role_id <> 1)
      ORDER BY u.User_id DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $resp['ok'] = true;
    $resp['message'] = 'Employees retrieved successfully';
    $resp['employees'] = $employees;
  }
  // POST - Create new employee
  elseif ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!is_array($data)) {
      $data = $_POST;
    }
    
    $username = isset($data['username']) ? trim((string)$data['username']) : '';
    $email = isset($data['email']) ? trim((string)$data['email']) : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    $role_id = isset($data['role_id']) ? (int)$data['role_id'] : 1;
    $client_id = isset($data['client_id']) && $data['client_id'] ? (int)$data['client_id'] : null;
    // Optional fields from signup
    $full_name = isset($data['name']) ? trim((string)$data['name']) : '';
    $business_name = isset($data['business_name']) ? trim((string)$data['business_name']) : '';
    $location = isset($data['location']) ? trim((string)$data['location']) : '';

    // Handle uploaded files (business_permit, dti/dtr, spa)
    $uploadsDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads';
    if (!is_dir($uploadsDir)) {
      @mkdir($uploadsDir, 0777, true);
    }
    $business_permit_file = null;
    $dti_file = null;
    $spa_file = null;

    $saveUpload = function($file, $prefix) use ($uploadsDir) {
      if (!isset($file) || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) { return null; }
      if (!is_uploaded_file($file['tmp_name'])) { return null; }
      $orig = $file['name'] ?? 'file';
      $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
      if (!preg_match('/^[a-z0-9]{1,8}$/', $ext)) { $ext = 'dat'; }
      try { $rand = bin2hex(random_bytes(4)); } catch (Throwable $e) { $rand = substr(sha1(mt_rand()), 0, 8); }
      $name = $prefix . '_' . date('YmdHis') . '_' . $rand . ($ext ? ('.' . $ext) : '');
      $dest = $uploadsDir . DIRECTORY_SEPARATOR . $name;
      if (!@move_uploaded_file($file['tmp_name'], $dest)) { return null; }
      return $name;
    };

    if (isset($_FILES['business_permit'])) {
      $business_permit_file = $saveUpload($_FILES['business_permit'], 'permit');
    }
    if (isset($_FILES['dti'])) {
      $dti_file = $saveUpload($_FILES['dti'], 'dti');
    } elseif (isset($_FILES['dtr'])) { // backward-compat: older field name
      $dti_file = $saveUpload($_FILES['dtr'], 'dti');
    }
    if (isset($_FILES['spa'])) {
      $spa_file = $saveUpload($_FILES['spa'], 'spa');
    }

    // Validate client_id exists; if not, set to NULL to satisfy FK constraint
    if ($client_id !== null) {
      $chkClient = $pdo->prepare('SELECT Client_ID FROM tblclient WHERE Client_ID = :cid LIMIT 1');
      $chkClient->execute([':cid' => $client_id]);
      if (!$chkClient->fetch(PDO::FETCH_ASSOC)) {
        $client_id = null;
      }
    }
    
    if ($username === '' || $password === '') {
      http_response_code(400);
      throw new RuntimeException('Username and password are required.');
    }
    
    // Check if username already exists
    $check = $pdo->prepare('SELECT User_id FROM tbluser WHERE Username = :u LIMIT 1');
    $check->execute([':u' => $username]);
    if ($check->fetch()) {
      http_response_code(400);
      throw new RuntimeException('Username already exists.');
    }
    
    // Hash password
    $hash = password_hash($password, PASSWORD_BCRYPT);

    // Create records within a transaction
    $pdo->beginTransaction();
    try {
      // If signup provided name or business, create a client row and use that Client_ID
      if ($full_name !== '' || $business_name !== '') {
        // Split name into first/middle/last (best effort)
        $parts = preg_split('/\s+/', trim($full_name));
        $first = '';
        $middle = null;
        $last = '';
        if ($parts && count($parts) > 0) {
          $first = array_shift($parts);
          if (count($parts) > 0) {
            $last = array_pop($parts);
            if (count($parts) > 0) {
              $middle = implode(' ', $parts);
            }
          }
        }
        if ($first === '' && $last === '') { $first = $username; $last = ' '; }

        $stmt = $pdo->prepare('INSERT INTO tblclient (First_name, Middle_name, Last_name, Email, Status_id) VALUES (:f, :m, :l, :e, :s)');
        $stmt->execute([
          ':f' => $first,
          ':m' => $middle,
          ':l' => $last,
          ':e' => $email ?: null,
          ':s' => null, // Pending by default
        ]);
        $client_id = (int)$pdo->lastInsertId();
      }

      // Insert new user
      $stmt = $pdo->prepare('INSERT INTO tbluser (Username, Password, Email, Role_id, Client_id) VALUES (:u, :p, :e, :r, :c)');
      $stmt->execute([
        ':u' => $username,
        ':p' => $hash,
        ':e' => $email ?: null,
        ':r' => $role_id,
        ':c' => $client_id,
      ]);
      $newUserId = (int)$pdo->lastInsertId();

      // Optionally create business record
      if ($business_name !== '' || $location !== null || $business_permit_file !== null || $dti_file !== null || $spa_file !== null) {
        try {
          $stmt = $pdo->prepare('INSERT INTO tblbusiness (Business_name, Location, Client_ID, User_id, Business_permit, DTI, SPA) VALUES (:bn, :loc, :cid, :uid, :bp, :dti, :spa)');
          $stmt->execute([
            ':bn' => $business_name !== '' ? $business_name : null,
            ':loc' => $location !== '' ? $location : null,
            ':cid' => $client_id,
            ':uid' => $newUserId,
            ':bp' => $business_permit_file,
            ':dti' => $dti_file,
            ':spa' => $spa_file,
          ]);
        } catch (Throwable $insEx) {
          // Fallback if columns don't exist yet
          $stmt = $pdo->prepare('INSERT INTO tblbusiness (Business_name, Location, Client_ID, User_id) VALUES (:bn, :loc, :cid, :uid)');
          $stmt->execute([
            ':bn' => $business_name !== '' ? $business_name : null,
            ':loc' => $location !== '' ? $location : null,
            ':cid' => $client_id,
            ':uid' => $newUserId,
          ]);
        }
      }

      $pdo->commit();

      $resp['ok'] = true;
      $resp['message'] = 'Employee created successfully';
      $resp['user_id'] = $newUserId;
    } catch (Throwable $txe) {
      try { $pdo->rollBack(); } catch (Throwable $ie) {}
      throw $txe;
    }
  }
  // PUT - Update employee
  elseif ($method === 'PUT') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!is_array($data)) {
      parse_str($raw, $data);
    }
    
    $user_id = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $username = isset($data['username']) ? trim((string)$data['username']) : '';
    $email = isset($data['email']) ? trim((string)$data['email']) : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    $role_id = isset($data['role_id']) ? (int)$data['role_id'] : 1;
    $client_id = isset($data['client_id']) && $data['client_id'] ? (int)$data['client_id'] : null;

    // Validate client_id exists; if not, set to NULL to satisfy FK constraint
    if ($client_id !== null) {
      $chkClient = $pdo->prepare('SELECT Client_ID FROM tblclient WHERE Client_ID = :cid LIMIT 1');
      $chkClient->execute([':cid' => $client_id]);
      if (!$chkClient->fetch(PDO::FETCH_ASSOC)) {
        $client_id = null;
      }
    }
    
    if ($user_id === 0 || $username === '') {
      http_response_code(400);
      throw new RuntimeException('User ID and username are required.');
    }
    
    // Check if user exists
    $check = $pdo->prepare('SELECT User_id FROM tbluser WHERE User_id = :id LIMIT 1');
    $check->execute([':id' => $user_id]);
    if (!$check->fetch()) {
      http_response_code(404);
      throw new RuntimeException('User not found.');
    }
    
    // Check if username is taken by another user
    $check = $pdo->prepare('SELECT User_id FROM tbluser WHERE Username = :u AND User_id != :id LIMIT 1');
    $check->execute([':u' => $username, ':id' => $user_id]);
    if ($check->fetch()) {
      http_response_code(400);
      throw new RuntimeException('Username already exists.');
    }
    
    // Update user
    if ($password !== '') {
      $hash = password_hash($password, PASSWORD_BCRYPT);
      $stmt = $pdo->prepare('UPDATE tbluser SET Username = :u, Password = :p, Email = :e, Role_id = :r, Client_id = :c WHERE User_id = :id');
      $stmt->execute([
        ':u' => $username,
        ':p' => $hash,
        ':e' => $email ?: null,
        ':r' => $role_id,
        ':c' => $client_id,
        ':id' => $user_id,
      ]);
    } else {
      $stmt = $pdo->prepare('UPDATE tbluser SET Username = :u, Email = :e, Role_id = :r, Client_id = :c WHERE User_id = :id');
      $stmt->execute([
        ':u' => $username,
        ':e' => $email ?: null,
        ':r' => $role_id,
        ':c' => $client_id,
        ':id' => $user_id,
      ]);
    }
    
    $resp['ok'] = true;
    $resp['message'] = 'Employee updated successfully';
  }
  // DELETE - Delete employee
  elseif ($method === 'DELETE') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!is_array($data)) {
      parse_str($raw, $data);
    }
    
    $user_id = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    
    if ($user_id === 0) {
      http_response_code(400);
      throw new RuntimeException('User ID is required.');
    }
    
    // Check if user exists
    $check = $pdo->prepare('SELECT User_id FROM tbluser WHERE User_id = :id LIMIT 1');
    $check->execute([':id' => $user_id]);
    if (!$check->fetch()) {
      http_response_code(404);
      throw new RuntimeException('User not found.');
    }
    
    // Delete user
    $stmt = $pdo->prepare('DELETE FROM tbluser WHERE User_id = :id');
    $stmt->execute([':id' => $user_id]);
    
    $resp['ok'] = true;
    $resp['message'] = 'Employee deleted successfully';
  } else {
    http_response_code(405);
    throw new RuntimeException('Method not allowed.');
  }
  
  echo json_encode($resp);
} catch (Throwable $e) {
  if (!http_response_code()) {
    http_response_code(500);
  }
  $resp['ok'] = false;
  $resp['message'] = $e->getMessage();
  echo json_encode($resp);
}
