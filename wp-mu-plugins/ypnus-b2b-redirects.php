<?php
/**
 * Plugin Name: YPN USA B2B Redirects
 * Description: 301-redirects retired borrower-facing loan pages to their B2B (loan officer) equivalents.
 * Version:     1.0.0
 *
 * Purpose: YPN USA sells a marketing plan to loan officers and does not advertise loans to borrowers.
 *          The /territory/*-loans-*, /territory/first-time-buyer-* and borrower-facing city "mortgage
 *          loan officer" pages spoke to home buyers, so they were trashed and each old path now 301s
 *          to the matching loan-officer page (/loan-types/<program>-leads/ or /markets/).
 * Date:    2026-10-01
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const YPNUS_B2B_REDIRECTS = [
	// -> /loan-types/fha-loan-leads/ (12)
	'/territory/fha-loans-bakersfield-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-fresno-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-fresno-california-david-moore-fresno-california/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-las-vegas-nv/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-los-angeles-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-modesto-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-phoenix-az/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-sacramento-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-san-diego-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-stockton-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-visalia-ca/' => '/loan-types/fha-loan-leads/',
	'/territory/fha-loans-visalia-california-david-j-moore-mba/' => '/loan-types/fha-loan-leads/',
	// -> /loan-types/va-loan-leads/ (10)
	'/territory/va-loans-bakersfield-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-fresno-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-las-vegas-nv/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-los-angeles-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-modesto-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-phoenix-az/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-sacramento-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-san-diego-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-stockton-ca/' => '/loan-types/va-loan-leads/',
	'/territory/va-loans-visalia-ca/' => '/loan-types/va-loan-leads/',
	// -> /loan-types/conventional-loan-leads/ (11)
	'/territory/conventional-loans-bakersfield-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-fresno-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-las-vegas-nv/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-los-angeles-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-modesto-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-phoenix-az/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-sacramento-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-san-diego-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-stockton-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-visalia-ca/' => '/loan-types/conventional-loan-leads/',
	'/territory/conventional-loans-visalia-california-david-j-moore-mba/' => '/loan-types/conventional-loan-leads/',
	// -> /loan-types/dscr-loan-leads/ (11)
	'/territory/dscr-loans-bakersfield-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-fresno-ca-david-j-moore/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-fresno-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-las-vegas-nv/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-los-angeles-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-modesto-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-phoenix-az/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-sacramento-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-san-diego-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-stockton-ca/' => '/loan-types/dscr-loan-leads/',
	'/territory/dscr-loans-visalia-ca/' => '/loan-types/dscr-loan-leads/',
	// -> /loan-types/first-time-buyer-leads/ (12)
	'/territory/first-time-buyer-bakersfield-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-fresno-ca-david-j-moore/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-fresno-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-las-vegas-nv/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-los-angeles-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-modesto-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-phoenix-az/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-sacramento-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-san-diego-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-stockton-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-visalia-ca/' => '/loan-types/first-time-buyer-leads/',
	'/territory/first-time-buyer-visalia-california-david-j-moore-mba/' => '/loan-types/first-time-buyer-leads/',
	// -> /loan-types/jumbo-loan-leads/ (2)
	'/territory/jumbo-loans-fresno-ca-david-j-moore/' => '/loan-types/jumbo-loan-leads/',
	'/territory/jumbo-loans-visalia-california-david-j-moore-mba/' => '/loan-types/jumbo-loan-leads/',
	// -> /markets/ (2)
	'/kingsburg-ca-mortgage-loan-officer/' => '/markets/',
	'/territory/visalia-ca-mortgage-loan-officer/' => '/markets/',
];

add_action(
	'template_redirect',
	static function () {
		$path = (string) wp_parse_url( (string) ( $_SERVER['REQUEST_URI'] ?? '' ), PHP_URL_PATH );
		$key  = '/' . trim( $path, '/' ) . '/';
		if ( isset( YPNUS_B2B_REDIRECTS[ $key ] ) ) {
			wp_redirect( home_url( YPNUS_B2B_REDIRECTS[ $key ] ), 301 );
			exit;
		}
	},
	0
);
