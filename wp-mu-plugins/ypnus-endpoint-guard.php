<?php
/**
 * Plugin Name: YPNUS Endpoint Guard (must-use)
 * Description: Auth and rate limits for custom public endpoints that publish content, send email, or spend AI credits.
 * Version: 1.0.0
 *
 * - MLO Toolkit AJAX: the agent chat (its tools create draft pages, rewrite saved agent tools and
 *   memory, and delete nav-menu items), content generator and keyword scout were registered for
 *   logged-out visitors behind a nonce that every logged-out visitor shares. They now require a
 *   capable account. The public website-preview demo (ypnus_demo_run) keeps its own per-IP daily limit.
 * - /ypnus/v1/create-mlo published "YPNUS Verified MLO" pages with any name and NMLS number for
 *   anyone on the internet. Nothing on the site calls it, so it is limited to administrators.
 * - /ypnus/v1/login: per-IP attempt limit and per-email failure lockout. A successful sign-in gets
 *   the same dashboard token /signup issues (see ypnus-lead-auth-guard.php).
 * - /ypnus/v1/request-reset: per-IP and per-email limits so reset emails can't be used to flood inboxes.
 */

defined( 'ABSPATH' ) || exit;

/** Visitor IP for rate limiting. REMOTE_ADDR is the real client on this host; proxy headers are client input. */
function ypnus_guard_ip() {
	if ( function_exists( 'ypnus_intake_client_ip' ) ) {
		$ip = ypnus_intake_client_ip();
		if ( $ip ) {
			return $ip;
		}
	}
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? filter_var( wp_unslash( $_SERVER['REMOTE_ADDR'] ), FILTER_VALIDATE_IP ) : false;
	return $ip ? $ip : '0.0.0.0';
}

/** Count one hit for a bucket; true once the bucket is already at its limit. */
function ypnus_guard_hit( $bucket, $limit, $window ) {
	$key  = 'ypnus_guard_' . md5( $bucket );
	$hits = (int) get_transient( $key );
	if ( $hits >= $limit ) {
		return true;
	}
	set_transient( $key, $hits + 1, $window );
	return false;
}

function ypnus_guard_email_param( WP_REST_Request $request ) {
	return strtolower( trim( (string) $request->get_param( 'email' ) ) );
}

add_action(
	'admin_init',
	static function () {
		if ( ! wp_doing_ajax() ) {
			return;
		}
		$action   = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : '';
		$required = array(
			'ypnus_agent_chat'       => 'manage_options',
			'ypnus_generate_content' => 'edit_posts',
			'ypnus_keyword_scout'    => 'edit_posts',
		);
		if ( isset( $required[ $action ] ) && ! current_user_can( $required[ $action ] ) ) {
			wp_send_json_error( array( 'message' => 'Please sign in with an authorized account to use this tool.' ), 403 );
		}
	},
	0
);

add_filter(
	'rest_pre_dispatch',
	static function ( $result, $server, $request ) {
		if ( null !== $result ) {
			return $result;
		}
		$route = $request->get_route();

		if ( '/ypnus/v1/create-mlo' === $route && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'rest_forbidden', 'Not allowed.', array( 'status' => rest_authorization_required_code() ) );
		}

		if ( '/ypnus/v1/login' === $route ) {
			if ( ypnus_guard_hit( 'login_ip_' . ypnus_guard_ip(), 20, 15 * MINUTE_IN_SECONDS ) ) {
				return new WP_Error( 'rate_limited', 'Too many sign-in attempts. Please wait 15 minutes and try again.', array( 'status' => 429 ) );
			}
			$email = ypnus_guard_email_param( $request );
			if ( '' !== $email && (int) get_transient( 'ypnus_guard_' . md5( 'login_fail_' . $email ) ) >= 8 ) {
				return new WP_Error( 'rate_limited', 'Too many failed sign-in attempts for this account. Wait an hour or reset your password.', array( 'status' => 429 ) );
			}
		}

		if ( '/ypnus/v1/request-reset' === $route ) {
			if ( ypnus_guard_hit( 'reset_ip_' . ypnus_guard_ip(), 10, HOUR_IN_SECONDS ) ) {
				return new WP_Error( 'rate_limited', 'Too many requests. Please try again later.', array( 'status' => 429 ) );
			}
			$email = ypnus_guard_email_param( $request );
			if ( '' !== $email && ypnus_guard_hit( 'reset_email_' . $email, 3, HOUR_IN_SECONDS ) ) {
				// Same reply as a real request, so the limit doesn't reveal which emails have accounts.
				return rest_ensure_response(
					array(
						'success' => true,
						'message' => 'If that email exists you will receive a reset link shortly.',
					)
				);
			}
		}

		return $result;
	},
	4,
	3
);

add_filter(
	'rest_post_dispatch',
	static function ( $response, $server, $request ) {
		if ( '/ypnus/v1/login' !== $request->get_route() || ! ( $response instanceof WP_REST_Response ) ) {
			return $response;
		}
		$email = ypnus_guard_email_param( $request );
		$data  = $response->get_data();
		if ( 200 === $response->get_status() && is_array( $data ) && ! empty( $data['lo_id'] ) ) {
			delete_transient( 'ypnus_guard_' . md5( 'login_fail_' . $email ) );
			$data['token'] = hash_hmac( 'sha256', (string) $data['lo_id'], wp_salt( 'auth' ) );
			$response->set_data( $data );
		} elseif ( '' !== $email && in_array( $response->get_status(), array( 401, 404 ), true ) ) {
			ypnus_guard_hit( 'login_fail_' . $email, PHP_INT_MAX, HOUR_IN_SECONDS );
		}
		return $response;
	},
	20,
	3
);
