<?php
/**
 * Plugin Name: YPNUS SEO Titles (MU)
 * Description: Hard-force rankable document titles. MU so it always loads.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * @return array<string,string>
 */
function ypnus_mu_seo_titles() {
	return array(
		'/' => 'Mortgage Marketing Platform for Loan Officers | YPN USA',
		'/pricing-plans' => 'YPN USA Pricing for Loan Officers | Plans from $0/mo',
		'/mlo-growth-engine' => 'MLO Growth Engine: Exclusive ZIP Territory for Loan Officers',
		'/financing-mastery' => 'Financing Mastery for Loan Officers | DSCR, FHA, VA, Jumbo + Demand',
		'/predictive-lead-gen' => 'Predictive Lead Gen for Loan Officers | Owned Demand + AI | YPN USA',
		'/compare' => 'YPN USA vs Shared Mortgage Leads | Exclusive ZIP for Loan Officers',
		'/blog' => 'Loan Officer Marketing Blog: MLO Lead Gen Playbooks | YPN USA',
		'/contact' => 'Contact YPN USA | Mortgage Marketing Help for Loan Officers',
		'/about' => 'About YPN USA | Built by 25-Year Loan Officer David Moore',
		'/loan-officer-marketing-2026' => 'Loan Officer Marketing in 2026: Complete Strategy Guide | YPN USA',
		'/how-to-get-mortgage-leads-without-buying-them' => 'How to Get Mortgage Leads Without Buying Them (2026) | YPN USA',
		'/how-to-get-clients-as-a-new-loan-officer' => 'How to Get Clients as a New Loan Officer | No Database Playbook',
		'/exclusive-zip-territory-vs-shared-mortgage-leads' => 'Exclusive ZIP Territory vs Shared Mortgage Leads | MLO Guide',
		'/mlo-benefits-of-ypnus-owned-demand' => '7 Benefits YPN USA Gives Loan Officers | Owned Demand Stack',
		'/ai-borrower-intake-for-loan-officers' => 'AI Borrower Intake for Loan Officers | Own the First Conversation',
		'/stop-waiting-on-realtors-mlo-owned-demand' => 'Stop Waiting on Realtors: Owned Mortgage Demand for MLOs',
		'/text-message-marketing-for-loan-officers' => 'Text Message Marketing for Loan Officers | Compliant Scripts',
		'/linkedin-for-loan-officers' => 'LinkedIn for Loan Officers: Build Referral Partnerships | YPN USA',
		'/central-valley-financing-hub-fresno-visalia-dinuba' => 'Central Valley Financing Hub | Fresno, Visalia, Dinuba MLOs',
		'/features/hyper-local-seo-pages' => 'Hyper-Local SEO Pages for Loan Officers | Rank Local Mortgage Search',
		'/features/branded-mlo-website' => 'Branded MLO Website for Loan Officers | Borrower Pages Under Your Name',
	);
}

function ypnus_mu_request_path() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
	$path = wp_parse_url( $uri, PHP_URL_PATH );
	if ( ! is_string( $path ) || $path === '' ) {
		return '/';
	}
	$path = untrailingslashit( strtolower( $path ) );
	return $path === '' ? '/' : $path;
}

function ypnus_mu_title_for_request() {
	$path = ypnus_mu_request_path();
	$map  = ypnus_mu_seo_titles();
	if ( isset( $map[ $path ] ) ) {
		return $map[ $path ];
	}
	if ( preg_match( '#^/markets/leads-in-([a-z0-9-]+)-([a-z]{2})$#', $path, $m ) ) {
		$city = ucwords( str_replace( '-', ' ', $m[1] ) );
		$st   = strtoupper( $m[2] );
		return "Mortgage Leads for Loan Officers in {$city}, {$st} | Exclusive ZIP | YPN USA";
	}
	return null;
}

add_filter(
	'pre_get_document_title',
	static function ( $title ) {
		$t = ypnus_mu_title_for_request();
		return $t ? $t : $title;
	},
	PHP_INT_MAX
);

add_filter(
	'rank_math/frontend/title',
	static function ( $title ) {
		$t = ypnus_mu_title_for_request();
		return $t ? $t : $title;
	},
	PHP_INT_MAX
);

add_action(
	'plugins_loaded',
	static function () {
		if ( is_admin() ) {
			return;
		}
		ob_start(
			static function ( $html ) {
				if ( ! is_string( $html ) || $html === '' ) {
					return $html;
				}
				$t = ypnus_mu_title_for_request();
				if ( ! $t ) {
					return $html;
				}
				$inject = '<title>' . esc_html( $t ) . '</title>';
				$t0     = stripos( $html, '<title' );
				$t1     = stripos( $html, '</title>' );
				if ( false !== $t0 && false !== $t1 && $t1 > $t0 ) {
					$html = substr( $html, 0, $t0 ) . $inject . substr( $html, $t1 + 8 );
				}
				// Always kill known bleed string
				$html = str_replace(
					'Mortgage Leads for Loan Officers | Grow Without Realtor Dependence',
					$t,
					$html
				);
				if ( false === strpos( $html, 'ypnus-mu-seo' ) && false !== strpos( $html, '</head>' ) ) {
					$html = str_replace( '</head>', '<!--ypnus-mu-seo:' . esc_html( ypnus_mu_request_path() ) . "-->\n</head>", $html );
				}
				return $html;
			}
		);
	},
	0
);

add_filter( 'litespeed_buffer_after', static function ( $html ) {
	if ( ! is_string( $html ) ) {
		return $html;
	}
	$t = ypnus_mu_title_for_request();
	if ( ! $t ) {
		return $html;
	}
	$inject = '<title>' . esc_html( $t ) . '</title>';
	$t0     = stripos( $html, '<title' );
	$t1     = stripos( $html, '</title>' );
	if ( false !== $t0 && false !== $t1 && $t1 > $t0 ) {
		$html = substr( $html, 0, $t0 ) . $inject . substr( $html, $t1 + 8 );
	}
	return str_replace(
		'Mortgage Leads for Loan Officers | Grow Without Realtor Dependence',
		$t,
		$html
	);
}, 99 );
