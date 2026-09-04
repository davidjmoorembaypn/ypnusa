<?php
/**
 * Plugin Name: YPNUS Trust & Schema
 * Description: Ships the commercial-readiness JSON-LD (Organization, ProfessionalService, WebSite, SoftwareApplication), the NMLS footer disclosure, an origin-scoped CORS allowance for app.ypnus.com on the zip-check route, HSTS, and non-www canonicalization for ypnus.com — as code, so it survives without hand-editing Rank Math's generated schema or the theme footer.
 * Version: 1.0.0
 * Author: YPN USA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'YPNUS_TRUST_NMLS_ID' ) ) {
	define( 'YPNUS_TRUST_NMLS_ID', '787257' );
}
if ( ! defined( 'YPNUS_TRUST_LEGAL_NAME' ) ) {
	define( 'YPNUS_TRUST_LEGAL_NAME', 'YPN INC' );
}
if ( ! defined( 'YPNUS_TRUST_APP_ORIGIN' ) ) {
	define( 'YPNUS_TRUST_APP_ORIGIN', 'https://app.ypnus.com' );
}

/**
 * ---------------------------------------------------------------------
 * 1. JSON-LD schema — Organization, ProfessionalService (Central Valley,
 *    CA), WebSite, and SoftwareApplication.
 *
 * Preferred path: Rank Math's own `rank_math/json_ld` filter, so this
 * merges into Rank Math's existing graph instead of fighting it or
 * getting stripped on save. Falls back to a raw <script> in wp_head only
 * when Rank Math isn't active, so a site with no SEO plugin still gets
 * the schema.
 * ---------------------------------------------------------------------
 */
function ypnus_trust_schema_entities() {
	$entities = array();

	$entities['ypnusOrganization'] = array(
		'@type'       => 'Organization',
		'name'        => 'YPN USA',
		'legalName'   => YPNUS_TRUST_LEGAL_NAME,
		'url'         => home_url( '/' ),
		'description' => 'YPN USA provides licensed mortgage loan officers with exclusive ZIP-code territory access, AI-assisted borrower intake, and lead management tools.',
		'identifier'  => array(
			'@type' => 'PropertyValue',
			'name'  => 'NMLS ID',
			'value' => YPNUS_TRUST_NMLS_ID,
		),
		'contactPoint' => array(
			'@type'       => 'ContactPoint',
			'contactType' => 'sales',
			'email'       => 'support@ypnus.com',
			'areaServed'  => 'US',
		),
	);

	$entities['ypnusLocalService'] = array(
		'@type'      => 'ProfessionalService',
		'name'       => 'YPN USA',
		'url'        => home_url( '/' ),
		'areaServed' => array(
			array( '@type' => 'City', 'name' => 'Fresno', 'containedInPlace' => 'California' ),
			array( '@type' => 'City', 'name' => 'Bakersfield', 'containedInPlace' => 'California' ),
			array( '@type' => 'City', 'name' => 'Stockton', 'containedInPlace' => 'California' ),
			array( '@type' => 'City', 'name' => 'Modesto', 'containedInPlace' => 'California' ),
			array( '@type' => 'AdministrativeArea', 'name' => 'Central Valley, California' ),
		),
		'address' => array(
			'@type'         => 'PostalAddress',
			'addressRegion' => 'CA',
			'addressCountry' => 'US',
		),
		'priceRange' => '$$',
		'identifier' => array(
			'@type' => 'PropertyValue',
			'name'  => 'NMLS ID',
			'value' => YPNUS_TRUST_NMLS_ID,
		),
	);

	$entities['ypnusWebSite'] = array(
		'@type'          => 'WebSite',
		'name'           => 'YPN USA',
		'url'            => home_url( '/' ),
		'potentialAction' => array(
			'@type'       => 'SearchAction',
			'target'      => home_url( '/?s={search_term_string}' ),
			'query-input' => 'required name=search_term_string',
		),
	);

	if ( is_page( 'pricing-plans' ) ) {
		$pricing_url = home_url( '/pricing-plans/' );
		$entities['ypnusSoftwareApplication'] = array(
			'@type'             => 'SoftwareApplication',
			'name'              => 'YPN USA Territory Platform',
			'url'               => YPNUS_TRUST_APP_ORIGIN,
			'applicationCategory' => 'BusinessApplication',
			'operatingSystem'   => 'Web',
			'provider'          => array(
				'@type' => 'Organization',
				'name'  => YPNUS_TRUST_LEGAL_NAME,
			),
			'offers' => array(
				array( '@type' => 'Offer', 'name' => 'Starter', 'url' => $pricing_url, 'priceCurrency' => 'USD', 'category' => 'subscription' ),
				array( '@type' => 'Offer', 'name' => 'Pro', 'url' => $pricing_url, 'priceCurrency' => 'USD', 'category' => 'subscription' ),
				array( '@type' => 'Offer', 'name' => 'Elite', 'url' => $pricing_url, 'priceCurrency' => 'USD', 'category' => 'subscription' ),
			),
		);
	}

	return $entities;
}

add_filter(
	'rank_math/json_ld',
	static function ( $data ) {
		if ( ! is_array( $data ) ) {
			$data = array();
		}
		return array_merge( $data, ypnus_trust_schema_entities() );
	},
	99,
	1
);

add_action(
	'wp_head',
	static function () {
		// Rank Math already emits this via the filter above — avoid a duplicate graph.
		if ( defined( 'RANK_MATH_VERSION' ) ) {
			return;
		}
		$graph = array();
		foreach ( ypnus_trust_schema_entities() as $entity ) {
			$graph[] = array_merge( array( '@context' => 'https://schema.org' ), $entity );
		}
		if ( empty( $graph ) ) {
			return;
		}
		echo "\n<script type=\"application/ld+json\">" . wp_json_encode( $graph ) . "</script>\n";
	},
	5
);

/**
 * ---------------------------------------------------------------------
 * 2. NMLS footer disclosure — B2B framing (licensed LOs, not consumer
 *    borrowers), fires on every front-end template via wp_footer so it
 *    doesn't depend on a specific theme's footer template file.
 * ---------------------------------------------------------------------
 */
add_action(
	'wp_footer',
	static function () {
		if ( is_admin() ) {
			return;
		}
		printf(
			'<div class="ypnus-nmls-disclosure" style="max-width:960px;margin:0 auto;padding:16px 20px;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">%s &middot; NMLS #%s &middot; This platform provides exclusive territory access and lead tools to licensed mortgage loan officers. Not a lender. Not a loan offer.</div>',
			esc_html( YPNUS_TRUST_LEGAL_NAME ),
			esc_html( YPNUS_TRUST_NMLS_ID )
		);
	},
	99
);

/**
 * ---------------------------------------------------------------------
 * 3. CORS — allow app.ypnus.com to call the ypnus/v1 REST namespace
 *    (zip-check, etc.) client-side. Scoped to that namespace and that
 *    single origin; everything else is untouched.
 * ---------------------------------------------------------------------
 */
add_filter(
	'rest_pre_serve_request',
	static function ( $served, $result, $request ) {
		$route = $request->get_route();
		if ( 0 !== strpos( $route, '/ypnus/v1' ) ) {
			return $served;
		}

		$origin = get_http_origin();
		if ( YPNUS_TRUST_APP_ORIGIN === $origin ) {
			header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
			header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Content-Type' );
			header( 'Vary: Origin' );
		}

		return $served;
	},
	10,
	3
);

/**
 * ---------------------------------------------------------------------
 * 4. HSTS at the WordPress origin — belt-and-suspenders alongside the
 *    hPanel "Force HTTPS + HSTS" toggle, mirroring the header already
 *    enforced at the app.ypnus.com Next.js origin.
 * ---------------------------------------------------------------------
 */
add_action(
	'send_headers',
	static function () {
		if ( is_ssl() && ! is_admin() ) {
			header( 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload' );
		}
	}
);

/**
 * ---------------------------------------------------------------------
 * 5. Canonical host redirect — sends any request on a host that doesn't
 *    match WordPress's own configured home_url() to the canonical host,
 *    in whichever direction (www <-> non-www) WordPress is actually set
 *    up for, so it never fights the site's real configuration.
 * ---------------------------------------------------------------------
 */
add_action(
	'template_redirect',
	static function () {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || defined( 'REST_REQUEST' ) ) {
			return;
		}

		$canonical_host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		$request_host    = isset( $_SERVER['HTTP_HOST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';

		if ( ! $canonical_host || ! $request_host || strtolower( $request_host ) === strtolower( $canonical_host ) ) {
			return;
		}

		$scheme       = is_ssl() ? 'https://' : 'http://';
		$request_uri  = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';
		$target       = 'https://' . $canonical_host . $request_uri;

		wp_safe_redirect( $target, 301 );
		exit;
	},
	1
);
