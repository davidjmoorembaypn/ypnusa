<?php
/**
 * Plugin Name: YPN USA Inner Pages CRO
 * Description: Inner-page conversion layer: removes the full-width featured image, adds main navigation and a "Check My ZIP" CTA to the header, and avoids a duplicate H1. Does not run on the homepage.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

// 1) No full-width featured image on pages/posts (GeneratePress). The CSS rule is a fallback for older GP versions.
add_action( 'wp', function () {
	if ( is_front_page() || ! is_singular() ) { return; }
	remove_action( 'generate_after_header', 'generate_featured_page_header', 10 );
	remove_action( 'generate_before_content', 'generate_featured_page_header_inside_single', 10 );
} );
add_action( 'wp_head', function () {
	if ( is_front_page() || ! is_singular() ) { return; }
	echo '<style id="ypn-no-hero-img">.featured-image.page-header-image,.page-header-image-single{display:none!important}</style>';
}, 99 );

// 2) Header nav + CTA, matching the homepage
add_action( 'generate_after_header_content', function () {
	if ( is_front_page() ) { return; }
	$links = array(
		'How It Works' => home_url( '/how-it-works/' ),
		'Platform'     => home_url( '/features/' ),
		'Pricing'      => home_url( '/#pricing' ),
		'Compare'      => home_url( '/vs/' ),
		'Guides'       => home_url( '/mlo-marketing/' ),
		'About'        => home_url( '/about/' ),
	);
	echo '<nav class="ypn-inner-nav" aria-label="Main">';
	foreach ( $links as $label => $url ) {
		printf( '<a class="ypn-l" href="%s">%s</a>', esc_url( $url ), esc_html( $label ) );
	}
	printf( '<a class="ypn-login" href="%s">Login</a>', esc_url( 'https://app.ypnus.com/login' ) );
	printf( '<a class="ypn-cta" href="%s">Check My ZIP</a>', esc_url( home_url( '/check-zip.html?utm_source=inner_nav&utm_medium=header' ) ) );
	echo '</nav>';
} );
add_action( 'wp_head', function () {
	if ( is_front_page() ) { return; }
	?>
<style id="ypn-inner-nav-css">
.site-header .inside-header{display:flex!important;flex-wrap:nowrap!important;align-items:center;justify-content:space-between;gap:16px}
.ypn-inner-nav{display:flex;align-items:center;gap:22px;font:600 15px/1 'Plus Jakarta Sans','IBM Plex Sans',system-ui,sans-serif}
.ypn-inner-nav a{color:#fff!important;text-decoration:none!important;opacity:.88}
.ypn-inner-nav a:hover{opacity:1}
.ypn-inner-nav .ypn-cta{background:#2F6FED;padding:12px 18px;border-radius:10px;opacity:1;box-shadow:0 8px 22px rgba(47,111,237,.35)}
@media(max-width:900px){.ypn-inner-nav .ypn-l{display:none}.ypn-inner-nav{gap:14px}}
</style>
	<?php
}, 99 );

// 3) One H1 per page: drop the theme title when the content provides its own H1
add_filter( 'generate_show_title', function ( $show ) {
	if ( is_singular() ) {
		$post = get_post();
		if ( $post && false !== stripos( $post->post_content, '<h1' ) ) { return false; }
	}
	return $show;
} );
