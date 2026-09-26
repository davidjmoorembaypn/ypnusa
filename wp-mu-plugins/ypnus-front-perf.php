<?php
/**
 * Plugin Name: YPNUS Front-end Perf (must-use)
 * Description: Drops duplicate front-end asset requests.
 * Version: 1.0.0
 *
 * ypnus-persuasion-engine.php enqueues its script and stylesheet as the 'ypnus-persuasion' handles
 * AND prints the same two files again in wp_footer, so every inner page downloaded both twice (the
 * script's own guard kept it from running twice). The footer copies stay; the queued duplicates go,
 * matching what ypnus-home-refine.php / ypnus-home-speed.php already do on the homepage.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_enqueue_scripts',
	static function () {
		if ( is_admin() ) {
			return;
		}
		wp_dequeue_script( 'ypnus-persuasion' );
		wp_dequeue_style( 'ypnus-persuasion' );
	},
	1001
);
