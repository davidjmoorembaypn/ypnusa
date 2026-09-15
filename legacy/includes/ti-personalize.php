<?php
// ti-personalize.php - Server-side visitor personalization

$visitor = [
    'city'          => 'Investor',
    'returning'     => isset($_COOKIE['ti_returning']) ? (int)$_COOKIE['ti_returning'] + 1 : 1,
    'referrer_type' => (isset($_SERVER['HTTP_REFERER']) && stripos($_SERVER['HTTP_REFERER'], 'facebook') !== false) ? 'flip' : 'general',
    'time_of_day'   => (int)date('H') >= 18 ? 'evening' : 'daytime',
    'device'        => (stripos($_SERVER['HTTP_USER_AGENT'] ?? '', 'Mobile') !== false || stripos($_SERVER['HTTP_USER_AGENT'] ?? '', 'Android') !== false) ? 'mobile' : 'desktop'
];

// Save returning visitor count
setcookie('ti_returning', $visitor['returning'], time() + 31536000, '/', '', false, true);

// Dynamic hero text
$hero_data = [
    'general' => [
        'headline' => 'Stop losing $20,000+ on bad real estate deals.',
        'sub'      => 'Know if a property is worth your capital BEFORE you invest — not after.',
        'cta'      => 'Get Your Free Investor Report'
    ],
    'flip' => [
        'headline' => 'Know a flip will actually pay before you buy it.',
        'sub'      => 'Instant rehab cost, ARV, and profit projections for any property.',
        'cta'      => 'Analyze a Flip Now'
    ]
];

$current_hero = ($visitor['referrer_type'] === 'flip') ? $hero_data['flip'] : $hero_data['general'];
$visitor['hero'] = $current_hero;
?>
