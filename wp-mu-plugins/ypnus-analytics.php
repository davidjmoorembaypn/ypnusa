<?php
/**
 * Plugin Name: YPNUS Analytics (must-use)
 * Description: Guarantees the GA4 tag on the homepage, where conversion events fire but no tag loaded.
 * Version: 1.0.0
 *
 * The homepage sends gtag('event', 'generate_lead', ...) and CTA-click events, but none of the code
 * that prints GA4 on other pages (Rank Math Analytics, Site Kit, ypnus-perf-tune's output buffer)
 * reaches the homepage's <head>, so every homepage conversion was dropped. This prints the property
 * Rank Math Analytics and the site's custom event code already use (G-2TGE9M58H4) on the front page
 * only, before any page code runs, so events queued by inline handlers reach a configured tag.
 */

defined( 'ABSPATH' ) || exit;

const YPNUS_GA4_MEASUREMENT_ID = 'G-2TGE9M58H4';

add_action(
	'wp_head',
	static function () {
		if ( is_admin() || ! is_front_page() ) {
			return;
		}
		$id = YPNUS_GA4_MEASUREMENT_ID;
		echo "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','" . esc_js( $id ) . "');</script>\n";
		echo '<script async src="' . esc_url( 'https://www.googletagmanager.com/gtag/js?id=' . $id ) . '"></script>' . "\n";
	},
	1
);
