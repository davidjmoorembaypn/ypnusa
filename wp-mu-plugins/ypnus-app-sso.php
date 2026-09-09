<?php
/**
 * Plugin Name: YPNUS App SSO Bridge
 * Description: Secure WordPress -> app.ypnus.com SSO handoff.
 * Version: 2.0.0
 *
 * NOT YET DEPLOYED. This is a prepared replacement for the live 1.x version of this exact
 * file (wp-content/mu-plugins/ypnus-app-sso.php) — see wp-mu-plugins/README.md before
 * uploading it.
 *
 * CHANGE FROM LIVE 1.x: the live version signs only 5 fields (email|sub|role|iat|next) and
 * always hardcodes role='mlo'. This version signs the full 8-field message
 * (email|sub|role|iat|next|tier|subscriptionStatus|trialEndsAt), pulling role and
 * entitlement from the linked WordPress user's canonical meta via
 * ypnus-lo-account-bridge.php, instead of asserting nothing about either.
 *
 * app.ypnus.com's src/lib/sso.ts already accepts BOTH the old 5-field and this 8-field
 * signature (a temporary compatibility layer added specifically so this upgrade can't break
 * login mid-rollout) — see that file's module doc comment. Deploy this whenever ready; there
 * is no ordering requirement against the app-side deploy in either direction.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the signed SSO handoff URL. Signs the full 8-field canonical message — every field
 * is part of what's verified, including the entitlement claim, so app.ypnus.com never has to
 * trust an unsigned tier/status. Falls back to empty-string entitlement fields (which
 * app.ypnus.com's resolveEntitlement treats as free/none) rather than omitting them — the
 * signed message always covers exactly these 8 fields, never fewer.
 *
 * @param string $email
 * @param string $sub                 Stable WordPress user id.
 * @param string $role                'mlo' or 'admin'.
 * @param string $next                Relative path into the app.
 * @param string $tier                free|starter|growth|pro|elite, or '' for none asserted.
 * @param string $subscription_status active|trialing|past_due|canceled|none, or ''.
 * @param string $trial_ends_at       ISO 8601, or '' when not trialing.
 * @return string Empty string if the shared secret isn't configured.
 */
function ypnus_app_sso_url( $email, $sub, $role = 'mlo', $next = '/dashboard', $tier = '', $subscription_status = '', $trial_ends_at = '' ) {
	$secret = defined( 'YPNUS_SSO_SHARED_SECRET' ) ? YPNUS_SSO_SHARED_SECRET : '';

	if ( ! $secret ) {
		return '';
	}

	$iat = (string) time();

	$message = implode(
		'|',
		array( $email, $sub, $role, $iat, $next, $tier, $subscription_status, $trial_ends_at )
	);

	$sig = rtrim(
		strtr(
			base64_encode( hash_hmac( 'sha256', $message, $secret, true ) ),
			'+/',
			'-_'
		),
		'='
	);

	$params = array(
		'email' => $email,
		'sub'   => $sub,
		'role'  => $role,
		'iat'   => $iat,
		'next'  => $next,
		'sig'   => $sig,
	);
	// Omit blank optional fields from the URL itself (they're still part of the signed
	// message as empty strings) — matches docs/sso-handoff.md's contract exactly.
	if ( '' !== $tier ) {
		$params['tier'] = $tier;
	}
	if ( '' !== $subscription_status ) {
		$params['subscriptionStatus'] = $subscription_status;
	}
	if ( '' !== $trial_ends_at ) {
		$params['trialEndsAt'] = $trial_ends_at;
	}

	return add_query_arg( $params, 'https://app.ypnus.com/api/auth/callback' );
}

/**
 * Determines the app-facing role from the linked WordPress user's real capabilities,
 * instead of hardcoding 'mlo' for every login. Anyone who can manage_options is treated as
 * an admin; everyone else is an mlo. Falls back to 'mlo' when no WordPress user could be
 * resolved (bridge not deployed, or link failed) — never blocks the login itself over this.
 *
 * @param int $wp_user_id
 * @return string
 */
function ypnus_app_sso_resolve_role( $wp_user_id ) {
	if ( $wp_user_id > 0 && user_can( $wp_user_id, 'manage_options' ) ) {
		return 'admin';
	}
	return 'mlo';
}

/**
 * Intercept the existing successful login response.
 * The existing login endpoint returns success + lo_id + email.
 */
add_filter(
	'rest_post_dispatch',
	function ( $response, $server, $request ) {

		if ( $request->get_route() !== '/ypnus/v1/login' ) {
			return $response;
		}

		if ( ! $response instanceof WP_REST_Response ) {
			return $response;
		}

		$data = $response->get_data();

		if (
			is_array( $data ) &&
			! empty( $data['success'] ) &&
			! empty( $data['email'] ) &&
			! empty( $data['lo_id'] )
		) {
			$email = sanitize_email( $data['email'] );
			$sub   = (string) $data['lo_id'];

			// Resolve the linked WordPress user for role + canonical entitlement. When the
			// identity bridge isn't deployed yet (function_exists guards), this degrades to
			// the old behavior: role hardcoded to 'mlo', no entitlement claim signed — which
			// is exactly what the live 1.x plugin does today, so this file is safe to deploy
			// even before ypnus-lo-account-bridge.php lands.
			$wp_user_id  = 0;
			$role        = 'mlo';
			$tier        = '';
			$status      = '';
			$trial_ends  = '';

			if ( function_exists( 'ypnus_resolve_or_link_wp_user' ) ) {
				$resolved = ypnus_resolve_or_link_wp_user( $sub );
				if ( ! is_wp_error( $resolved ) ) {
					$wp_user_id = (int) $resolved;
					$role       = ypnus_app_sso_resolve_role( $wp_user_id );
					if ( function_exists( 'ypnus_lo_account_entitlement' ) ) {
						$entitlement = ypnus_lo_account_entitlement( $wp_user_id );
						$tier        = $entitlement['tier'];
						$status      = $entitlement['subscriptionStatus'];
						$trial_ends  = $entitlement['trialEndsAt'];
					}
				}
				// is_wp_error($resolved): account not found / ambiguous mapping / link
				// failed. Never block the login redirect over this — fall through with
				// role='mlo' and no entitlement claim, same as the bridge being absent.
				// The account_mapping_conflict is already flagged for admin review by
				// ypnus-lo-account-bridge.php itself.
			}

			$url = ypnus_app_sso_url( $email, $sub, $role, '/dashboard', $tier, $status, $trial_ends );

			if ( $url ) {
				$data['sso_url']  = $url;
				$data['redirect'] = $url;
				$response->set_data( $data );
			}
		}

		return $response;

	},
	20,
	3
);
