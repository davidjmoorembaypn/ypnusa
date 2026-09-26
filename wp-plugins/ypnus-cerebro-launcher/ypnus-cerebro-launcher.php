<?php
/**
 * Plugin Name:       YPN Cerebro Launcher
 * Description:       Floating "Chat with Cerebro" button. The chat iframe is created only after the first click, so there is no page-load cost.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            YPN USA
 * License:           GPL-2.0-or-later
 * Text Domain:       ypnus-cerebro-launcher
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Should the launcher render on this request? Front end only.
 *
 * @return bool
 */
function ypnus_cerebro_should_render() {
	if ( defined( 'YPNUS_CEREBRO_DISABLED' ) && YPNUS_CEREBRO_DISABLED ) {
		return false;
	}
	if ( is_admin() || is_customize_preview() || is_feed() || is_embed() ) {
		return false;
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return false;
	}
	if ( defined( 'DOING_AJAX' ) && DOING_AJAX ) {
		return false;
	}
	// wp-login.php / wp-register.php do not fire wp_footer, but guard anyway.
	global $pagenow;
	if ( isset( $pagenow ) && in_array( $pagenow, array( 'wp-login.php', 'wp-register.php' ), true ) ) {
		return false;
	}
	if ( isset( $_GET['nocerebro'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return false;
	}
	// Page builders and previews.
	if ( isset( $_GET['preview'] ) || isset( $_GET['elementor-preview'] ) || isset( $_GET['fl_builder'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return false;
	}
	return true;
}

/**
 * Print the launcher (button, hidden panel shell, inline CSS and JS).
 */
function ypnus_cerebro_render() {
	if ( ! ypnus_cerebro_should_render() ) {
		return;
	}

	$origin = apply_filters( 'ypnus_cerebro_origin', 'https://app.ypnus.com' );
	$origin = is_string( $origin ) ? untrailingslashit( esc_url_raw( $origin ) ) : '';
	if ( '' === $origin ) {
		$origin = 'https://app.ypnus.com';
	}
	$src = $origin . '/embed/cerebro';
	?>
<style id="ypnus-cerebro-css">
#ypnus-cerebro-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:2px solid #D4AF5C;background:#0A1628;color:#D4AF5C;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 8px 28px rgba(5,9,15,.45);transition:transform .18s ease,box-shadow .18s ease}
#ypnus-cerebro-btn:hover{transform:scale(1.06);box-shadow:0 12px 34px rgba(5,9,15,.55)}
#ypnus-cerebro-btn:focus-visible{outline:3px solid #2F6FED;outline-offset:3px}
#ypnus-cerebro-btn svg{width:28px;height:28px;display:block}
#ypnus-cerebro-panel{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:380px;height:600px;max-height:calc(100vh - 112px);max-height:calc(100dvh - 112px);border-radius:18px;overflow:hidden;background:#0A1628;border:1px solid rgba(212,175,92,.55);box-shadow:0 20px 60px rgba(5,9,15,.55);opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s}
#ypnus-cerebro-panel.ypnus-open{opacity:1;visibility:visible;transform:none;transition:opacity .2s ease,transform .2s ease}
#ypnus-cerebro-panel iframe{width:100%;height:100%;border:0;display:block;background:#0A1628}
#ypnus-cerebro-close{display:none;position:absolute;top:8px;right:8px;z-index:2;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,22,40,.85);color:#fff;cursor:pointer;align-items:center;justify-content:center;padding:0;font-size:20px;line-height:1}
#ypnus-cerebro-close:focus-visible{outline:3px solid #D4AF5C;outline-offset:2px}
@media (max-width:600px){
#ypnus-cerebro-panel{right:8px;left:8px;bottom:8px;top:8px;width:auto;height:auto;max-height:none;border-radius:16px}
#ypnus-cerebro-btn.ypnus-open{display:none}
#ypnus-cerebro-close{display:flex}
}
@media (prefers-reduced-motion:reduce){
#ypnus-cerebro-btn,#ypnus-cerebro-panel,#ypnus-cerebro-panel.ypnus-open{transition:none}
#ypnus-cerebro-btn:hover{transform:none}
#ypnus-cerebro-panel{transform:none}
}
</style>
<button type="button" id="ypnus-cerebro-btn" aria-label="<?php echo esc_attr__( 'Chat with Cerebro', 'ypnus-cerebro-launcher' ); ?>" aria-expanded="false" aria-controls="ypnus-cerebro-panel">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>
</button>
<div id="ypnus-cerebro-panel" role="dialog" aria-label="<?php echo esc_attr__( 'Cerebro assistant', 'ypnus-cerebro-launcher' ); ?>">
	<button type="button" id="ypnus-cerebro-close" aria-label="<?php echo esc_attr__( 'Close Cerebro', 'ypnus-cerebro-launcher' ); ?>">&times;</button>
</div>
<script id="ypnus-cerebro-js">
(function () {
	var SRC = <?php echo wp_json_encode( $src ); ?>;
	var btn = document.getElementById('ypnus-cerebro-btn');
	var panel = document.getElementById('ypnus-cerebro-panel');
	var closeBtn = document.getElementById('ypnus-cerebro-close');
	if (!btn || !panel) { return; }
	var frame = null;
	var open = false;

	function setOpen(next) {
		open = next;
		btn.setAttribute('aria-expanded', open ? 'true' : 'false');
		btn.classList.toggle('ypnus-open', open);
		panel.classList.toggle('ypnus-open', open);
		if (open && !frame) {
			frame = document.createElement('iframe');
			frame.src = SRC;
			frame.title = 'Cerebro assistant';
			frame.loading = 'lazy';
			frame.setAttribute('allow', '');
			frame.referrerPolicy = 'strict-origin-when-cross-origin';
			panel.appendChild(frame);
		}
		if (open) {
			if (frame) { frame.focus(); }
		} else {
			btn.focus();
		}
	}

	btn.addEventListener('click', function () { setOpen(!open); });
	if (closeBtn) { closeBtn.addEventListener('click', function () { setOpen(false); }); }
	document.addEventListener('keydown', function (e) {
		if (open && (e.key === 'Escape' || e.key === 'Esc')) { setOpen(false); }
	});
})();
</script>
	<?php
}
add_action( 'wp_footer', 'ypnus_cerebro_render', 100 );
