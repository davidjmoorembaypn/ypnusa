<?php
/**
 * Plugin Name: YPNUS Supabase Signup Bridge
 * Description: LO signup API with WordPress persistence and optional Supabase Auth sync.
 * Version: 1.2.0
 *
 * NOT YET DEPLOYED. This is a prepared replacement for the live 1.1.0 version of this exact
 * file (wp-content/mu-plugins/ypnus-supabase-signup.php) — see wp-mu-plugins/README.md.
 *
 * CHANGE FROM LIVE 1.1.0: /signup-config's intake_page_url now points at
 * https://app.ypnus.com/embed/intake — a real, working route in the app.ypnus.com repo — instead
 * of the legacy static https://ypnus.com/ypn-ai-borrower-intake.html page. That legacy page is
 * NOT deleted or redirected here; it's left reachable at its existing URL. Whether it should
 * eventually 301 to the new one is a product decision, not made by this patch — see the
 * comment on YPNUS_LEGACY_INTAKE_PAGE_URL below.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'YPNUS_SIGNUP_DB_VERSION', '1.1.0' ); // bumped 2026-08-19: added zip_of_interest
define( 'YPNUS_INTAKE_DB_VERSION', '1.0.0' );

/**
 * Canonical MLO acquisition/intake entry as of 1.2.0. app.ypnus.com/embed/intake is a real,
 * existing route (src/app/embed/intake/page.tsx) — confirmed during the commercial-readiness
 * audit, not a placeholder.
 */
define( 'YPNUS_CANONICAL_INTAKE_URL', 'https://app.ypnus.com/embed/intake' );

/**
 * The pre-1.2.0 canonical intake page. Kept reachable, NOT deleted and NOT auto-redirected —
 * whether it should eventually 301 to YPNUS_CANONICAL_INTAKE_URL is a pending product
 * decision (it depends on whether anything live still links to it directly; that wasn't
 * confirmed as part of this patch). If/when that decision is made, wire the redirect here
 * with a simple template_redirect check on this path — do not just delete the page.
 */
define( 'YPNUS_LEGACY_INTAKE_PAGE_URL', 'https://ypnus.com/ypn-ai-borrower-intake.html' );

/**
 * @return string
 */
function ypnus_signup_table_name() {
	global $wpdb;
	return $wpdb->prefix . 'ypnus_lo_accounts';
}

/**
 * @return string
 */
function ypnus_intake_table_name() {
	global $wpdb;
	return $wpdb->prefix . 'ypnus_borrower_leads';
}

/**
 * @return string
 */
function ypnus_intake_client_ip() {
	foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $key ) {
		if ( empty( $_SERVER[ $key ] ) ) {
			continue;
		}
		$raw = (string) wp_unslash( $_SERVER[ $key ] );
		if ( $key === 'HTTP_X_FORWARDED_FOR' ) {
			$raw = trim( explode( ',', $raw )[0] );
		}
		if ( filter_var( $raw, FILTER_VALIDATE_IP ) ) {
			return $raw;
		}
	}
	return '';
}

/**
 * @return true|WP_Error
 */
function ypnus_intake_rate_limit() {
	$ip  = ypnus_intake_client_ip();
	$key = 'ypnus_intake_' . md5( $ip ? $ip : 'unknown' );
	$hits = (int) get_transient( $key );
	if ( $hits >= 12 ) {
		return new WP_Error( 'rate_limited', 'Too many submissions. Please try again later.', array( 'status' => 429 ) );
	}
	set_transient( $key, $hits + 1, 10 * MINUTE_IN_SECONDS );
	return true;
}

add_action(
	'init',
	static function () {
		global $wpdb;
		$charset = $wpdb->get_charset_collate();
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		if ( get_option( 'ypnus_signup_db_version' ) !== YPNUS_SIGNUP_DB_VERSION ) {
			$table = ypnus_signup_table_name();
			$sql   = "CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				lo_id varchar(32) NOT NULL,
				user_uuid char(36) DEFAULT NULL,
				first_name varchar(100) NOT NULL,
				last_name varchar(100) NOT NULL,
				email varchar(190) NOT NULL,
				phone varchar(40) NOT NULL,
				zip_of_interest varchar(5) DEFAULT NULL,
				status varchar(20) NOT NULL DEFAULT 'trial',
				source varchar(40) NOT NULL DEFAULT 'lo-signup',
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY lo_id (lo_id),
				UNIQUE KEY email (email),
				KEY status (status)
			) {$charset};";
			dbDelta( $sql );
			update_option( 'ypnus_signup_db_version', YPNUS_SIGNUP_DB_VERSION );
		}

		if ( get_option( 'ypnus_intake_db_version' ) !== YPNUS_INTAKE_DB_VERSION ) {
			$table = ypnus_intake_table_name();
			$sql   = "CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				lo_id varchar(32) NOT NULL DEFAULT '',
				name varchar(190) NOT NULL DEFAULT '',
				email varchar(190) NOT NULL DEFAULT '',
				phone varchar(40) NOT NULL DEFAULT '',
				loan_type varchar(80) NOT NULL DEFAULT '',
				loan_program varchar(80) NOT NULL DEFAULT '',
				credit_score varchar(40) NOT NULL DEFAULT '',
				income varchar(80) NOT NULL DEFAULT '',
				purchase_price varchar(80) NOT NULL DEFAULT '',
				timeline varchar(80) NOT NULL DEFAULT '',
				lead_score smallint NOT NULL DEFAULT 0,
				lead_quality varchar(20) NOT NULL DEFAULT 'Cool',
				recommended_program varchar(120) NOT NULL DEFAULT '',
				payload longtext NULL,
				source_url varchar(255) NOT NULL DEFAULT '',
				status varchar(20) NOT NULL DEFAULT 'new',
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY lo_id (lo_id),
				KEY created_at (created_at),
				KEY lead_quality (lead_quality)
			) {$charset};";
			dbDelta( $sql );
			update_option( 'ypnus_intake_db_version', YPNUS_INTAKE_DB_VERSION );
		}
	},
	5
);

/**
 * @return array{url:string,anon_key:string,service_key:string,configured:bool}
 */
function ypnus_get_supabase_settings() {
	$url         = trim( (string) get_option( 'ypnus_supabase_url', '' ) );
	$anon_key    = trim( (string) get_option( 'ypnus_supabase_anon_key', '' ) );
	$service_key = trim( (string) get_option( 'ypnus_supabase_service_key', '' ) );

	$configured = (
		$url !== '' &&
		$anon_key !== '' &&
		$service_key !== '' &&
		strpos( $url, 'YOUR_' ) !== 0 &&
		strpos( $anon_key, 'YOUR_' ) !== 0 &&
		strpos( $service_key, 'YOUR_' ) !== 0 &&
		strpos( $url, 'supabase.co' ) !== false
	);

	return compact( 'url', 'anon_key', 'service_key', 'configured' );
}

/**
 * @return string
 */
function ypnus_generate_lo_id() {
	return 'lo_' . wp_generate_password( 10, false, false ) . base_convert( (string) time(), 10, 36 );
}

/**
 * @param array<string, mixed> $payload
 * @return array<string, mixed>|WP_Error
 */
function ypnus_supabase_admin_request( array $payload ) {
	$settings = ypnus_get_supabase_settings();
	if ( ! $settings['configured'] ) {
		return new WP_Error( 'supabase_not_configured', 'Supabase is not configured.' );
	}

	$response = wp_remote_post(
		rtrim( $settings['url'], '/' ) . '/auth/v1/admin/users',
		array(
			'timeout' => 20,
			'headers' => array(
				'apikey'       => $settings['service_key'],
				'Authorization' => 'Bearer ' . $settings['service_key'],
				'Content-Type' => 'application/json',
			),
			'body'    => wp_json_encode( $payload ),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

	if ( $code < 200 || $code >= 300 ) {
		$message = is_array( $body ) && ! empty( $body['msg'] ) ? (string) $body['msg'] : 'Supabase auth request failed.';
		if ( is_array( $body ) && ! empty( $body['message'] ) ) {
			$message = (string) $body['message'];
		}
		return new WP_Error( 'supabase_auth_failed', $message, array( 'status' => $code ) );
	}

	return is_array( $body ) ? $body : array();
}

/**
 * @param array<string, mixed> $row
 * @return true|WP_Error
 */
function ypnus_supabase_insert_lo_profile( array $row ) {
	$settings = ypnus_get_supabase_settings();
	if ( ! $settings['configured'] ) {
		return new WP_Error( 'supabase_not_configured', 'Supabase is not configured.' );
	}

	$response = wp_remote_post(
		rtrim( $settings['url'], '/' ) . '/rest/v1/loan_officers',
		array(
			'timeout' => 20,
			'headers' => array(
				'apikey'        => $settings['service_key'],
				'Authorization' => 'Bearer ' . $settings['service_key'],
				'Content-Type'  => 'application/json',
				'Prefer'        => 'return=minimal',
			),
			'body'    => wp_json_encode( $row ),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( $code < 200 || $code >= 300 ) {
		$body    = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		$message = is_array( $body ) && ! empty( $body['message'] ) ? (string) $body['message'] : 'Supabase profile insert failed.';
		return new WP_Error( 'supabase_profile_failed', $message, array( 'status' => $code ) );
	}

	return true;
}

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'ypnus/v1',
			'/signup-config',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function () {
					$settings = ypnus_get_supabase_settings();
					return rest_ensure_response(
						array(
							'mode'              => $settings['configured'] ? 'supabase' : 'wordpress',
							'supabase_url'      => $settings['configured'] ? $settings['url'] : '',
							'supabase_anon_key' => $settings['configured'] ? $settings['anon_key'] : '',
							'widget_base_url'   => 'https://ypnus.com/widget.js',
							'intake_page_url'   => YPNUS_CANONICAL_INTAKE_URL,
							'signup_endpoint'   => rest_url( 'ypnus/v1/signup' ),
							'intake_endpoint'   => rest_url( 'ypnus/v1/intake' ),
							'leads_endpoint'    => rest_url( 'ypnus/v1/leads' ),
							'profile_endpoint'  => rest_url( 'ypnus/v1/profile' ),
						)
					);
				},
			)
		);

		register_rest_route(
			'ypnus/v1',
			'/signup',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					// Honeypot: a hidden field real visitors never fill in. Bots that
					// fill every field on a form trip this immediately.
					if ( sanitize_text_field( (string) $request->get_param( 'website' ) ) !== '' ) {
						return new WP_Error( 'spam_detected', 'Could not create your account. Please try again.', array( 'status' => 400 ) );
					}
					// Timing trap: a real person takes at least a couple seconds to fill
					// the form; scripted submissions tend to fire instantly on page load.
					$form_started_at = (float) $request->get_param( 'form_started_at' );
					if ( $form_started_at > 0 && ( microtime( true ) - $form_started_at ) < 2 ) {
						return new WP_Error( 'spam_detected', 'Please take a moment before submitting.', array( 'status' => 400 ) );
					}
					// Per-IP rate limit, separate from the intake widget's own limiter.
					$signup_ip = ypnus_intake_client_ip();
					$signup_rl_key = 'ypnus_signup_rl_' . md5( $signup_ip ? $signup_ip : 'unknown' );
					$signup_rl_hits = (int) get_transient( $signup_rl_key );
					if ( $signup_rl_hits >= 5 ) {
						return new WP_Error( 'rate_limited', 'Too many signups from this connection. Please try again later.', array( 'status' => 429 ) );
					}
					set_transient( $signup_rl_key, $signup_rl_hits + 1, 10 * MINUTE_IN_SECONDS );

					$first_name = sanitize_text_field( (string) $request->get_param( 'first_name' ) );
					$last_name  = sanitize_text_field( (string) $request->get_param( 'last_name' ) );
					$email      = sanitize_email( (string) $request->get_param( 'email' ) );
					$phone      = sanitize_text_field( (string) $request->get_param( 'phone' ) );
					$password   = (string) $request->get_param( 'password' );
					// Optional - the ZIP they were looking at on the signup page, so the
					// dashboard has something specific to show after signup instead of
					// a blank slate. Not required; silently ignored if malformed.
					$zip_raw       = (string) $request->get_param( 'zip' );
					$zip_of_interest = preg_match( '/^\d{5}$/', $zip_raw ) ? $zip_raw : null;

					if ( $first_name === '' || $last_name === '' || $email === '' || $phone === '' || $password === '' ) {
						return new WP_Error( 'missing_fields', 'All fields are required.', array( 'status' => 400 ) );
					}
					if ( ! is_email( $email ) ) {
						return new WP_Error( 'invalid_email', 'Enter a valid email address.', array( 'status' => 400 ) );
					}
					if ( strlen( $password ) < 8 ) {
						return new WP_Error( 'weak_password', 'Password must be at least 8 characters.', array( 'status' => 400 ) );
					}

					global $wpdb;
					$table = ypnus_signup_table_name();

					$existing = (int) $wpdb->get_var(
						$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE email = %s", $email )
					);
					if ( $existing > 0 ) {
						return new WP_Error( 'email_exists', 'An account with this email already exists.', array( 'status' => 409 ) );
					}

					$lo_id     = ypnus_generate_lo_id();
					$user_uuid = null;
					$settings  = ypnus_get_supabase_settings();

					if ( $settings['configured'] ) {
						$auth = ypnus_supabase_admin_request(
							array(
								'email'         => $email,
								'password'      => $password,
								'email_confirm' => true,
								'user_metadata' => array(
									'first_name' => $first_name,
									'last_name'  => $last_name,
									'phone'      => $phone,
								),
							)
						);

						if ( is_wp_error( $auth ) ) {
							return $auth;
						}

						$user_uuid = isset( $auth['id'] ) ? (string) $auth['id'] : null;
						if ( $user_uuid ) {
							$profile = ypnus_supabase_insert_lo_profile(
								array(
									'id'         => $user_uuid,
									'lo_id'      => $lo_id,
									'first_name' => $first_name,
									'last_name'  => $last_name,
									'email'      => $email,
									'phone'      => $phone,
									'status'     => 'trial',
								)
							);
							if ( is_wp_error( $profile ) ) {
								return $profile;
							}
						}
					}

					$inserted = $wpdb->insert(
						$table,
						array(
							'lo_id'      => $lo_id,
							'user_uuid'  => $user_uuid,
							'first_name' => $first_name,
							'last_name'  => $last_name,
							'email'      => $email,
							'phone'      => $phone,
							'zip_of_interest' => $zip_of_interest,
							'password_hash' => password_hash( $password, PASSWORD_DEFAULT ),
							'status'     => 'trial',
							'source'     => $settings['configured'] ? 'supabase' : 'wordpress',
						),
						array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
					);

					if ( ! $inserted ) {
						return new WP_Error( 'db_insert_failed', 'Could not save your account. Please try again.', array( 'status' => 500 ) );
					}

					wp_mail(
						get_option( 'admin_email' ),
						'[FYI — auto welcome sent] New LO signup: ' . $first_name . ' ' . $last_name,
						"New signup (visitor already got automated welcome + follow-up emails — no reply needed unless they ask):\n\n"
						. "Name: {$first_name} {$last_name}\nEmail: {$email}\nPhone: {$phone}\nLO ID: {$lo_id}\nMode: " . ( $settings['configured'] ? 'supabase' : 'wordpress' )
					);

					if ( function_exists( 'ypnus_ej_send_template' ) ) {
						ypnus_ej_send_template(
							$email,
							'signup_welcome',
							array(
								'first_name' => $first_name,
								'lo_id'      => $lo_id,
							)
						);
						if ( function_exists( 'ypnus_ej_schedule' ) ) {
							$schedules = array(
								array( 'signup_followup_d1', DAY_IN_SECONDS ),
								array( 'signup_followup_d3', 3 * DAY_IN_SECONDS ),
								array( 'signup_followup_d7', 7 * DAY_IN_SECONDS ),
								array( 'signup_followup_d12', 12 * DAY_IN_SECONDS ),
							);
							foreach ( $schedules as $row ) {
								ypnus_ej_schedule(
									$email,
									$row[0],
									$row[1],
									array( 'first_name' => $first_name )
								);
							}
						}
					}
	do_action( 'ypnus_after_signup', $lo_id, $first_name, $email );

					return rest_ensure_response(
						array(
							'success' => true,
							'lo_id'   => $lo_id,
							'mode'    => $settings['configured'] ? 'supabase' : 'wordpress',
						)
					);
				},
			)
		);

		register_rest_route(
			'ypnus/v1',
			'/profile',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					$lo_id = sanitize_text_field( (string) $request->get_param( 'lo_id' ) );
					if ( $lo_id === '' ) {
						return new WP_Error( 'missing_lo_id', 'lo_id is required.', array( 'status' => 400 ) );
					}

					global $wpdb;
					$row = $wpdb->get_row(
						$wpdb->prepare(
							'SELECT lo_id, first_name, last_name, email, phone, zip_of_interest, status, created_at FROM ' . ypnus_signup_table_name() . ' WHERE lo_id = %s LIMIT 1',
							$lo_id
						),
						ARRAY_A
					);

					if ( ! $row ) {
						return new WP_Error( 'not_found', 'Account not found.', array( 'status' => 404 ) );
					}

					return rest_ensure_response( $row );
				},
			)
		);

		register_rest_route(
			'ypnus/v1',
			'/leads',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					$lo_id = sanitize_text_field( (string) $request->get_param( 'lo_id' ) );
					if ( $lo_id === '' ) {
						return new WP_Error( 'missing_lo_id', 'lo_id is required.', array( 'status' => 400 ) );
					}

					global $wpdb;
					$table = ypnus_intake_table_name();
					$rows  = $wpdb->get_results(
						$wpdb->prepare(
							"SELECT id, lo_id, name, email, phone, loan_type, loan_program, credit_score, income, purchase_price, timeline, lead_score, lead_quality, recommended_program, source_url, status, created_at FROM {$table} WHERE lo_id = %s ORDER BY created_at DESC LIMIT 500",
							$lo_id
						),
						ARRAY_A
					);

					return rest_ensure_response(
						array(
							'leads' => is_array( $rows ) ? $rows : array(),
						)
					);
				},
			)
		);

		register_rest_route(
			'ypnus/v1',
			'/intake',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					$limited = ypnus_intake_rate_limit();
					if ( is_wp_error( $limited ) ) {
						return $limited;
					}

					$lo_id = sanitize_text_field( (string) $request->get_param( 'lo_id' ) );
					$name  = sanitize_text_field( (string) $request->get_param( 'name' ) );
					$email = sanitize_email( (string) $request->get_param( 'email' ) );
					$phone = sanitize_text_field( (string) $request->get_param( 'phone' ) );

					if ( $name === '' || ! is_email( $email ) || $phone === '' ) {
						return new WP_Error( 'missing_fields', 'Name, email, and phone are required.', array( 'status' => 400 ) );
					}

					$lead_score    = max( 0, min( 100, (int) $request->get_param( 'lead_score' ) ) );
					$lead_quality  = sanitize_text_field( (string) $request->get_param( 'lead_quality' ) );
					$loan_type     = sanitize_text_field( (string) $request->get_param( 'loan_type' ) );
					$loan_program  = sanitize_text_field( (string) $request->get_param( 'loan_program' ) );
					$credit_score  = sanitize_text_field( (string) $request->get_param( 'credit_score' ) );
					$income        = sanitize_text_field( (string) $request->get_param( 'income' ) );
					$purchase      = sanitize_text_field( (string) $request->get_param( 'purchase_price' ) );
					$timeline      = sanitize_text_field( (string) $request->get_param( 'timeline' ) );
					$rec_program   = sanitize_text_field( (string) $request->get_param( 'recommended_program' ) );
					$source_url    = esc_url_raw( (string) $request->get_param( 'source_url' ) );
					$payload_raw   = $request->get_param( 'payload' );
					$payload       = is_array( $payload_raw ) ? wp_json_encode( $payload_raw ) : sanitize_textarea_field( (string) $payload_raw );

					if ( $lead_quality === '' ) {
						$lead_quality = $lead_score >= 70 ? 'Hot' : ( $lead_score >= 40 ? 'Warm' : 'Cool' );
					}

					global $wpdb;
					$inserted = $wpdb->insert(
						ypnus_intake_table_name(),
						array(
							'lo_id'                => $lo_id,
							'name'                 => $name,
							'email'                => $email,
							'phone'                => $phone,
							'loan_type'            => $loan_type,
							'loan_program'         => $loan_program,
							'credit_score'         => $credit_score,
							'income'               => $income,
							'purchase_price'       => $purchase,
							'timeline'             => $timeline,
							'lead_score'           => $lead_score,
							'lead_quality'         => $lead_quality,
							'recommended_program'  => $rec_program,
							'payload'              => $payload,
							'source_url'           => $source_url,
							'status'               => 'new',
						),
						array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s' )
					);

					if ( ! $inserted ) {
						return new WP_Error( 'db_insert_failed', 'Could not save lead.', array( 'status' => 500 ) );
					}

					wp_mail(
						get_option( 'admin_email' ),
						'New YPNUS borrower lead: ' . $name,
						"LO ID: {$lo_id}\nName: {$name}\nEmail: {$email}\nPhone: {$phone}\nScore: {$lead_score} ({$lead_quality})\nLoan: {$loan_type} / {$loan_program}"
					);

					return rest_ensure_response(
						array(
							'success' => true,
							'id'      => (int) $wpdb->insert_id,
						)
					);
				},
			)
		);
	}
);
