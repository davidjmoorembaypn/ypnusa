<?php
/**
 * Plugin Name: YPNUS SEO Hygiene
 * Description: Crawl-budget and indexation hygiene for ypnus.com — keeps Rank Math sitemaps focused on real pages, noindexes thin utility routes, documents the app.ypnus.com split, and exposes Rank Math's SEO title/description as REST fields.
 * Version: 1.1.0
 * Author: YPN USA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep attachments / media out of XML sitemaps.
 * Live page-sitemap.xml was emitting .jpg/.webp URLs which waste crawl budget.
 */
add_filter(
	'rank_math/sitemap/exclude_post_type',
	static function ( $exclude, $post_type ) {
		if ( in_array( $post_type, array( 'attachment', 'elementor_library' ), true ) ) {
			return true;
		}
		return $exclude;
	},
	10,
	2
);

/**
 * Do not advertise the app subdomain's giant inventory from WordPress robots.
 */
add_filter(
	'robots_txt',
	static function ( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}

		$note  = "\n# YPNUS SEO Hygiene\n";
		$note .= "# Marketing host = ypnus.com (this file)\n";
		$note .= "# Product/territory host = https://app.ypnus.com/\n";
		$note .= "# Do not mirror app.ypnus.com's 70k ZIP sitemap here.\n";

		return $output . $note;
	},
	20,
	2
);

/**
 * Soft-noindex known thin or utility surfaces that should not compete with money pages.
 * Only applies when Rank Math / WP robots APIs are available.
 */
add_action(
	'wp_head',
	static function () {
		if ( is_admin() ) {
			return;
		}

		$path = wp_parse_url( home_url( add_query_arg( array() ) ), PHP_URL_PATH );
		$path = is_string( $path ) ? untrailingslashit( $path ) : '';

		$noindex_prefixes = array(
			'/site-directory',
			'/sitemap',
		);

		foreach ( $noindex_prefixes as $prefix ) {
			if ( $path === $prefix || 0 === strpos( $path, $prefix . '/' ) ) {
				echo "<meta name=\"robots\" content=\"noindex,follow\" />\n";
				return;
			}
		}
	},
	1
);

/**
 * Prefer a single pricing URL in internal tooling defaults.
 */
add_filter(
	'ypnus_primary_pricing_url',
	static function () {
		return home_url( '/pricing-plans/' );
	}
);

/**
 * Expose Rank Math's own SEO title/description meta as readable + writable REST
 * fields on pages and posts. Rank Math stores these under the `rank_math_title`
 * and `rank_math_description` post meta keys but does not register them for
 * REST itself — the Website Autopilot's seo_title / seo_meta_description
 * changes (src/lib/wordpress.ts in the app repo) write to these exact field
 * names, so without this they would 404/no-op against the REST API.
 */
add_action(
	'rest_api_init',
	static function () {
		foreach ( array( 'page', 'post' ) as $post_type ) {
			foreach ( array( 'rank_math_title', 'rank_math_description' ) as $meta_key ) {
				register_rest_field(
					$post_type,
					$meta_key,
					array(
						'get_callback'    => static function ( $object ) use ( $meta_key ) {
							return get_post_meta( $object['id'], $meta_key, true );
						},
						'update_callback' => static function ( $value, $post ) use ( $meta_key ) {
							if ( ! current_user_can( 'edit_post', $post->ID ) ) {
								return new WP_Error(
									'rest_forbidden',
									'Not allowed to edit this field.',
									array( 'status' => rest_authorization_required_code() )
								);
							}
							if ( ! is_string( $value ) ) {
								return new WP_Error( 'rest_invalid_type', $meta_key . ' must be a string.', array( 'status' => 400 ) );
							}
							update_post_meta( $post->ID, $meta_key, sanitize_text_field( $value ) );
							return true;
						},
						'schema'          => array(
							'type'        => 'string',
							'description' => 'rank_math_title' === $meta_key ? 'Rank Math SEO title' : 'Rank Math SEO meta description',
							'context'     => array( 'view', 'edit' ),
						),
					)
				);
			}
		}
	}
);
