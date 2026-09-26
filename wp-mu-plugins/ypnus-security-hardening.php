<?php
/**
 * Plugin Name: YPN USA Security Hardening
 * Description: Blocks username enumeration, login brute-force, and sensitive WP files.
 * Version: 1.0.0
 */
defined( 'ABSPATH' ) || exit;

/** Max failed logins per IP before temporary lockout. */
const YPNUS_LOGIN_MAX_ATTEMPTS = 5;

/** Lockout window in seconds (15 minutes). */
const YPNUS_LOGIN_LOCKOUT_SECONDS = 900;

/**
 * Client IP for rate limiting.
 */
function ypnus_security_client_ip() {
	// Proxy headers are client input on this host (REMOTE_ADDR already holds the real visitor IP);
	// trusting them let anyone reset the lockout by sending a fake X-Forwarded-For.
	if ( function_exists( 'ypnus_intake_client_ip' ) ) {
		$ip = ypnus_intake_client_ip();
		return $ip ? $ip : '0.0.0.0';
	}
	$candidates = array( 'REMOTE_ADDR' );

	foreach ( $candidates as $key ) {
		if ( empty( $_SERVER[ $key ] ) ) {
			continue;
		}
		$raw = (string) $_SERVER[ $key ];
		if ( 'HTTP_X_FORWARDED_FOR' === $key ) {
			$parts = explode( ',', $raw );
			$raw   = trim( $parts[0] );
		}
		$ip = filter_var( $raw, FILTER_VALIDATE_IP );
		if ( $ip ) {
			return $ip;
		}
	}

	return '0.0.0.0';
}

/**
 * Transient key for login attempt tracking.
 */
function ypnus_security_login_transient_key() {
	return 'ypnus_login_fail_' . md5( ypnus_security_client_ip() );
}

/**
 * Block REST user enumeration for visitors.
 *
 * @param array<string, mixed> $endpoints Registered REST routes.
 * @return array<string, mixed>
 */
function ypnus_security_filter_rest_endpoints( $endpoints ) {
	if ( is_user_logged_in() ) {
		return $endpoints;
	}

	unset( $endpoints['/wp/v2/users'] );
	unset( $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );

	return $endpoints;
}

add_filter( 'rest_endpoints', 'ypnus_security_filter_rest_endpoints', 99 );

/** Block ?author= ID scans that reveal usernames. */
add_action(
	'init',
	static function () {
		if ( is_user_logged_in() ) {
			return;
		}
		if ( isset( $_REQUEST['author'] ) && is_numeric( $_REQUEST['author'] ) ) {
			wp_safe_redirect( home_url( '/' ), 301 );
			exit;
		}
	},
	1
);

/** Hide author archive pages from the public. */
add_action(
	'template_redirect',
	static function () {
		if ( ! is_user_logged_in() && is_author() ) {
			wp_safe_redirect( home_url( '/' ), 301 );
			exit;
		}
	},
	1
);

/** Block direct access to readme/license and xmlrpc brute-force surface. */
add_action(
	'init',
	static function () {
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		$path = strtolower( (string) parse_url( $uri, PHP_URL_PATH ) );

		$blocked = array(
			'/readme.html',
			'/license.txt',
			'/wp-config-sample.php',
		);

		if ( in_array( $path, $blocked, true ) ) {
			status_header( 403 );
			exit;
		}

		if ( '/xmlrpc.php' === $path ) {
			status_header( 403 );
			header( 'Content-Type: text/plain; charset=utf-8' );
			echo 'XML-RPC disabled.';
			exit;
		}
	},
	0
);

/** Slow down brute-force login attempts by IP. */
add_filter(
	'authenticate',
	static function ( $user, $username, $password ) {
		unset( $username, $password );

		$key      = ypnus_security_login_transient_key();
		$attempts = (int) get_transient( $key );

		if ( $attempts >= YPNUS_LOGIN_MAX_ATTEMPTS ) {
			return new WP_Error(
				'ypnus_too_many_login_attempts',
				sprintf(
					/* translators: %d: minutes */
					__( 'Too many failed login attempts. Please try again in %d minutes.', 'ypnus' ),
					(int) ceil( YPNUS_LOGIN_LOCKOUT_SECONDS / 60 )
				)
			);
		}

		return $user;
	},
	30,
	3
);

add_action(
	'wp_login_failed',
	static function () {
		$key      = ypnus_security_login_transient_key();
		$attempts = (int) get_transient( $key );
		++$attempts;
		set_transient( $key, $attempts, YPNUS_LOGIN_LOCKOUT_SECONDS );
	}
);

add_action(
	'wp_login',
	static function () {
		delete_transient( ypnus_security_login_transient_key() );
	},
	10,
	0
);