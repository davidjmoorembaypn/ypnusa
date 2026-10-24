<?php
/**
 * Plugin Name: YPNUS SEO Routing (must-use)
 * Description: Keeps pillar pages reachable, sitemaps valid, and templated ZIP pages out of the index.
 * Version: 1.0.0
 *
 * - Rank Math's "strip category base" lets a category archive take over a page with the same slug.
 *   /blog/ (the site's top page in Search Console), /financing-mastery/, /mlo-growth-engine/ and
 *   /predictive-lead-gen/ served noindexed category archives instead of the Blog page and the
 *   ~1,700-word pillar pages the sitemap lists. When a published page owns the slug, the page now
 *   wins; categories without a same-slug page keep their stripped URLs.
 * - The page sitemap listed static app files (lo-dashboard.html, onboarding.html) and a nested
 *   sitemap index (/markets/zip-sitemap.xml) as if they were pages. They are dropped.
 * - /markets/zip-NNNNN/ are ~30,800 templated pages (about 84% identical text, some for ZIP codes
 *   that don't exist) with zero Search Console impressions. They stay live for visitors but send
 *   "noindex, follow", so they can't be judged as scaled/doorway content against the whole domain.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'request',
	static function ( $query_vars ) {
		if ( is_admin() || empty( $query_vars['category_name'] ) || ! empty( $query_vars['feed'] ) ) {
			return $query_vars;
		}
		$slug = (string) $query_vars['category_name'];
		if ( false !== strpos( $slug, '/' ) ) {
			return $query_vars;
		}
		$page = get_page_by_path( $slug );
		if ( ! $page || 'publish' !== $page->post_status ) {
			return $query_vars;
		}
		$page_vars = array( 'pagename' => $slug );
		if ( ! empty( $query_vars['paged'] ) ) {
			$page_vars['paged'] = $query_vars['paged'];
		}
		return $page_vars;
	},
	5
);

add_filter(
	'rank_math/sitemap/page_content',
	static function ( $content ) {
		return (string) preg_replace(
			'#<url>\s*<loc>[^<]*/(?:lo-dashboard\.html|onboarding\.html|markets/zip-sitemap\.xml)</loc>.*?</url>\s*#s',
			'',
			(string) $content
		);
	},
	999
);

function ypnus_is_templated_zip_page() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
	return (bool) preg_match( '#^/markets/zip-\d{5}/?$#', $path );
}

add_action(
	'send_headers',
	static function () {
		if ( ypnus_is_templated_zip_page() ) {
			header( 'X-Robots-Tag: noindex, follow', false );
		}
	}
);
