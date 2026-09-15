<?php
header('Content-Type: application/json');
$path = $_GET['path'] ?? 'public_html';
$fullPath = '/home/u853154979/domains/ypnus.com/' . $path;

if (!is_dir($fullPath)) {
    echo json_encode(['error' => 'Directory not found']);
    exit;
}

$files = scandir($fullPath);
$result = [];
foreach ($files as $file) {
    if ($file !== '.' && $file !== '..') {
        $result[] = $file;
    }
}
echo json_encode(['path' => $path, 'files' => $result]);
?>
