<?php
/**
 * YPNUS — Sitewide Header CTA Bar (cross-domain Login/Dashboard)
 * Deployed as mu-plugin so it runs on every template without a page builder dependency.
 */
if (!defined('ABSPATH')) exit;

add_action('generate_after_header', 'ypnus_render_header_cta_bar');

function ypnus_render_header_cta_bar() {
    $ypnus_is_logged_in_hint = isset($_COOKIE['ypnus_session']) && $_COOKIE['ypnus_session'] !== '';
    $login_url     = 'https://app.ypnus.com/login';
    $dashboard_url = 'https://app.ypnus.com/dashboard';
    ?>
    <div class="ypnus-cta-bar" role="navigation" aria-label="YPNUS account actions">
        <div class="ypnus-cta-bar__inner">
            <?php if ($ypnus_is_logged_in_hint) : ?>
                <a href="<?php echo esc_url($dashboard_url); ?>" class="ypnus-cta-btn ypnus-cta-btn--dashboard">Dashboard</a>
            <?php else : ?>
                <a href="<?php echo esc_url($login_url); ?>" class="ypnus-cta-btn ypnus-cta-btn--login">Login</a>
            <?php endif; ?>
        </div>
    </div>
    <style>
        .ypnus-cta-bar{width:100%;background:#0f1b3d;box-sizing:border-box;}
        .ypnus-cta-bar__inner{max-width:1200px;margin:0 auto;padding:8px 20px;display:flex;justify-content:flex-end;align-items:center;box-sizing:border-box;}
        .ypnus-cta-btn{display:inline-block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1;text-decoration:none;padding:8px 18px;border-radius:6px;transition:background-color .15s ease,opacity .15s ease;color:#fff;}
        .ypnus-cta-btn--login{background:#1c3faa;}
        .ypnus-cta-btn--login:hover,.ypnus-cta-btn--login:focus{background:#16308a;color:#fff;}
        .ypnus-cta-btn--dashboard{background:#1c8a5e;}
        .ypnus-cta-btn--dashboard:hover,.ypnus-cta-btn--dashboard:focus{background:#156b48;color:#fff;}
        @media (max-width:480px){
            .ypnus-cta-bar__inner{padding:6px 12px;justify-content:center;}
            .ypnus-cta-btn{width:100%;max-width:280px;text-align:center;padding:10px 16px;font-size:13px;}
        }
    </style>
    <?php
}