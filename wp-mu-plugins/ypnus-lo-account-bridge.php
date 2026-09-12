<?php
/**
 * Plugin Name: YPNUS LO Account Identity Bridge
 * Description: Links each wp_ypnus_lo_accounts row (the table an MLO actually logs in
 *              against) to exactly one WordPress user (the table ypnus-stripe-webhook.php
 *              writes ypnus_tier / ypnus_subscription_status / ypnus_trial_ends_at onto).
 *              Without this, a Stripe purchase has no code path back to the account the
 *              buyer logs in with — see the app.ypnus.com commercial-readiness audit.
 * Version: 1.0.0
 * Author: YPN USA
 *
 * NOT YET DEPLOYED. This file does not exist on the live site. It is a prepared artifact —
 * review and upload to wp-content/mu-plugins/ when ready. See wp-mu-plugins/README.md.
 *
 * Canonical entitlement source stays WordPress user meta (ypnus_tier, ypnus_subscription_status,
 * ypnus_trial_ends_at, ypnus_stripe_customer_id, ypnus_stripe_subscription_id — all written by
 * ypnus-stripe-webhook.php). This file adds exactly one new column (wp_user_id) to the existing
 * wp_ypnus_lo_accounts table as a foreign-key link — it does not create a second entitlement
 * store, and never caches tier/status here.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'YPNUS_LO_BRIDGE_VERSION', '1.0.0' );

/**
 * The LO accounts table. Reuses ypnus-supabase-signup.php's own name function when that
 * plugin is loaded (same request, mu-plugins load in filename order — "ypnus-lo-account-
 * bridge.php" sorts before "ypnus-supabase-signup.php", so don't assume load order; both
 * paths compute the identical table name independently instead of depending on it).
 *
 * @return string
 */
function ypnus_lo_accounts_table() {
	global $wpdb;
	return $wpdb->prefix . 'ypnus_lo_accounts';
}

/**
 * Adds the wp_user_id link column to wp_ypnus_lo_accounts for sites where the signup
 * plugin's table already existed before this bridge was deployed. Versioned init-hook
 * migration, same pattern as ypnus-stripe-webhook.php's territory/lifecycle table upgrades —
 * register_activation_hook doesn't fire for a plain mu-plugin drop-in at all, so this is the
 * only migration path available here.
 */
// The signup plugin creates its base table at priority 5. Run after it so a fresh install
// receives wp_user_id during the same request instead of waiting for a later page load.
add_action( 'init', 'ypnus_lo_bridge_maybe_upgrade_schema', 6 );

function ypnus_lo_bridge_maybe_upgrade_schema() {
	if ( get_option( 'ypnus_lo_bridge_schema_v1' ) ) {
		return;
	}
	global $wpdb;
	$table = ypnus_lo_accounts_table();

	// Guard: only touch the table if the signup plugin actually created it. A bare
	// ALTER/dbDelta against a table that doesn't exist yet would otherwise create a
	// malformed one, which is worse than doing nothing and retrying on the next request.
	$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
	if ( $exists !== $table ) {
		return;
	}

	$has_column = $wpdb->get_row( "SHOW COLUMNS FROM {$table} LIKE 'wp_user_id'" );
	if ( ! $has_column ) {
		$wpdb->query( "ALTER TABLE {$table} ADD COLUMN wp_user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER user_uuid" );
		$wpdb->query( "ALTER TABLE {$table} ADD KEY wp_user_id (wp_user_id)" );
	}

	update_option( 'ypnus_lo_bridge_schema_v1', 1, false );
}

/**
 * Normalizes an email the same way for every lookup/link in this file, so "Jordan@Foo.com"
 * and "jordan@foo.com" are always treated as the same identity.
 *
 * @param string $email
 * @return string
 */
function ypnus_lo_bridge_normalize_email( $email ) {
	return strtolower( trim( (string) $email ) );
}

/**
 * READ-ONLY lookup: does this email already have a linked wp_user? Never creates or
 * modifies anything — safe to call from a payment-processing path (ypnus-stripe-webhook.php
 * calls this via function_exists() before falling back to a plain email lookup) without
 * that path acquiring identity-linking side effects it didn't ask for.
 *
 * @param string $email
 * @return int WordPress user ID, or 0 if no linked account is found.
 */
function ypnus_lo_account_wp_user_id( $email ) {
	global $wpdb;
	$email = ypnus_lo_bridge_normalize_email( $email );
	if ( '' === $email ) {
		return 0;
	}
	$table = ypnus_lo_accounts_table();
	$id    = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT wp_user_id FROM {$table} WHERE email = %s AND wp_user_id IS NOT NULL LIMIT 1",
			$email
		)
	);
	return $id ? (int) $id : 0;
}

/**
 * The write path: resolves (creating/linking if necessary) the WordPress user for a given
 * LO account. Call this right after signup (already wired below via ypnus_after_signup) and
 * on every login (already wired below via the /ypnus/v1/login response filter), so a stale
 * or never-linked account self-heals the moment its owner authenticates.
 *
 * Design, matching the product decision this was built against:
 *   - wp_user_id already set on the lo_accounts row -> fast path, just return it.
 *   - Not set: normalize the account's email and look for exactly one matching wp_users row.
 *     - Exactly one match, and it isn't already linked to a DIFFERENT lo_accounts row -> link it.
 *     - Exactly one match, but it's already linked elsewhere -> ambiguous. Fail closed: return a
 *       WP_Error, do NOT guess, and record the conflict for admin review (ypnus_lo_bridge_conflicts
 *       option) instead of silently overwriting either side.
 *     - No match -> create a new wp_user (role: subscriber, matching ypnus-stripe-webhook.php's own
 *       provisioning convention) and link it. This wp_user is an entitlement-meta anchor only — the
 *       LO's actual login credential stays in wp_ypnus_lo_accounts.password_hash, never in WP core
 *       auth, so the generated wp_user password is unusable/irrelevant by design.
 *
 * @param string $lo_id
 * @return int|WP_Error WordPress user ID on success.
 */
function ypnus_resolve_or_link_wp_user( $lo_id ) {
	global $wpdb;
	$table = ypnus_lo_accounts_table();

	$account = $wpdb->get_row(
		$wpdb->prepare( "SELECT lo_id, email, wp_user_id FROM {$table} WHERE lo_id = %s LIMIT 1", $lo_id )
	);
	if ( ! $account ) {
		return new WP_Error( 'lo_account_not_found', 'No LO account found for that lo_id.' );
	}
	if ( ! empty( $account->wp_user_id ) ) {
		return (int) $account->wp_user_id;
	}

	$email = ypnus_lo_bridge_normalize_email( $account->email );
	if ( ! is_email( $email ) ) {
		return new WP_Error( 'lo_account_invalid_email', 'LO account has no usable email to link.' );
	}

	$existing = get_user_by( 'email', $email );

	if ( $existing ) {
		$already_linked_elsewhere = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT lo_id FROM {$table} WHERE wp_user_id = %d AND lo_id != %s LIMIT 1",
				$existing->ID,
				$lo_id
			)
		);
		if ( $already_linked_elsewhere ) {
			ypnus_lo_bridge_flag_conflict( $lo_id, $email, (int) $existing->ID, (string) $already_linked_elsewhere );
			return new WP_Error(
				'ambiguous_account_mapping',
				'This WordPress user is already linked to a different LO account. Needs manual resolution.'
			);
		}
		$wp_user_id = (int) $existing->ID;
	} else {
		$wp_user_id = wp_insert_user(
			array(
				'user_login' => ypnus_lo_bridge_unique_username( $email ),
				'user_email' => $email,
				'user_pass'  => wp_generate_password( 32 ),
				'role'       => 'subscriber',
			)
		);
		if ( is_wp_error( $wp_user_id ) ) {
			return $wp_user_id;
		}
	}

	$updated = $wpdb->update(
		$table,
		array( 'wp_user_id' => $wp_user_id ),
		array( 'lo_id' => $lo_id ),
		array( '%d' ),
		array( '%s' )
	);
	if ( false === $updated ) {
		return new WP_Error( 'lo_account_link_failed', 'Could not persist the account link.' );
	}

	return $wp_user_id;
}

/**
 * Records an ambiguous mapping for manual admin review. Never auto-resolved — same
 * philosophy as ypnus-stripe-webhook.php's account_mapping_conflict / territory_conflict.
 */
function ypnus_lo_bridge_flag_conflict( $lo_id, $email, $wp_user_id, $held_by_lo_id ) {
	$log   = get_option( 'ypnus_lo_bridge_conflicts', array() );
	$log   = is_array( $log ) ? $log : array();
	$log[] = array(
		'lo_id'          => $lo_id,
		'email'          => $email,
		'wp_user_id'     => $wp_user_id,
		'held_by_lo_id'  => $held_by_lo_id,
		'time'           => gmdate( 'c' ),
	);
	update_option( 'ypnus_lo_bridge_conflicts', array_slice( $log, -200 ), false );
}

function ypnus_lo_bridge_unique_username( $email ) {
	$local = strstr( $email, '@', true );
	$local = sanitize_user( false === $local ? 'ypnuslo' : $local, true );
	$local = $local ? substr( $local, 0, 38 ) : 'ypnuslo';
	$base  = $local . '-' . substr( hash( 'sha256', $email ), 0, 12 );
	$name  = substr( $base, 0, 60 );
	$index = 1;
	while ( username_exists( $name ) ) {
		$suffix = '-' . $index;
		$name   = substr( $base, 0, 60 - strlen( $suffix ) ) . $suffix;
		++$index;
	}
	return $name;
}

/**
 * Canonical entitlement read for a linked WordPress user. WordPress user meta (written by
 * ypnus-stripe-webhook.php) is authoritative — this is a read-through, not a cache.
 * Unknown/missing tier values fail closed to 'free', matching app.ypnus.com's own
 * resolveEntitlement() convention (see entitlements.ts).
 *
 * @param int $wp_user_id
 * @return array{tier:string,subscriptionStatus:string,trialEndsAt:string}
 */
function ypnus_lo_account_entitlement( $wp_user_id ) {
	$allowed_tiers = array( 'free', 'starter', 'growth', 'pro', 'elite' );
	$tier          = (string) get_user_meta( $wp_user_id, 'ypnus_tier', true );
	$status        = (string) get_user_meta( $wp_user_id, 'ypnus_subscription_status', true );
	$trial_ends_at = (string) get_user_meta( $wp_user_id, 'ypnus_trial_ends_at', true );

	if ( ! in_array( $tier, $allowed_tiers, true ) ) {
		$tier = 'free';
	}
	$allowed_statuses = array( 'active', 'trialing', 'past_due', 'canceled', 'none' );
	if ( ! in_array( $status, $allowed_statuses, true ) ) {
		$status = 'none';
	}

	return array(
		'tier'               => $tier,
		'subscriptionStatus' => $status,
		'trialEndsAt'        => 'trialing' === $status ? $trial_ends_at : '',
	);
}

/**
 * Link (or backfill-link) the WordPress user the moment an LO account is created.
 * "Transactional as far as practical" per the product decision this was built against:
 * this fires synchronously in the same request as the signup insert, so the gap between
 * "LO account exists" and "WordPress user linked" is effectively zero in the normal case.
 * It is not a real cross-store DB transaction (the custom table row and wp_insert_user are
 * different mechanisms that can't share one) — if this step fails, the LO account still
 * exists and will self-heal on next login via the hook below.
 */
add_action(
	'ypnus_after_signup',
	static function ( $lo_id, $first_name, $email ) {
		ypnus_resolve_or_link_wp_user( $lo_id );
	},
	20,
	3
);

/**
 * Resolve (or backfill-link) on every successful login too — covers every account created
 * before this bridge existed, and self-heals a signup-time link that failed.
 */
add_filter(
	'rest_post_dispatch',
	static function ( $response, $server, $request ) {
		if ( '/ypnus/v1/login' !== $request->get_route() ) {
			return $response;
		}
		if ( ! $response instanceof WP_REST_Response ) {
			return $response;
		}
		$data = $response->get_data();
		if ( is_array( $data ) && ! empty( $data['success'] ) && ! empty( $data['lo_id'] ) ) {
			$wp_user_id = ypnus_resolve_or_link_wp_user( (string) $data['lo_id'] );
			if ( ! is_wp_error( $wp_user_id ) ) {
				// The custom LO credential was verified by /ypnus/v1/login. Establish the matching
				// WordPress session so same-origin /profile and /leads requests authenticate as
				// the linked owner instead of being administrator-only in practice.
				wp_set_current_user( (int) $wp_user_id );
				wp_set_auth_cookie( (int) $wp_user_id, false, is_ssl() );
			}
		}
		return $response;
	},
	10,
	3
);
