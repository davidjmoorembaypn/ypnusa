<?php
/**
 * Plugin Name: YPN USA Commercial Optimizer
 * Description: Conversion CTAs, trust signals, LiteSpeed perf, click tracking.
 * Version: 2.2.0
 *
 * NOT YET DEPLOYED. This is a prepared replacement for the live 2.1.0 version of this exact
 * file (wp-content/mu-plugins/ypnus-commercial-optimize.php) — see wp-mu-plugins/README.md.
 *
 * CHANGE FROM LIVE 2.1.0: the pricing-page hero banner used to hardcode its own copy of the
 * tier names, prices, and Stripe URLs directly in HTML — a second, independent source of
 * truth that had already drifted from ypn_pricing_tiers()/ypn_stripe_urls() (still showing
 * the old 3-tier $29.99/$99.99/$299.99 model with no Growth). It now renders from those
 * functions instead, so it can never drift again. Requires ypnus-brand-config.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** LiteSpeed: keep conversion-critical assets immediate. */
add_filter(
	'litespeed_optm_js_exc',
	static function ( $excludes ) {
		$add = array(
			'widget.js',
			'ypnus-chatbot-loader',
			'ypnus-static-conversion',
			'stripe.com',
			'buy.stripe.com',
			'js.stripe.com',
			'googletagmanager',
			'gtag',
			'ai-engine',
			'mwai',
			'chatbot',
		);
		return array_values( array_unique( array_merge( (array) $excludes, $add ) ) );
	}
);

/**
 * Marketing pages that should show conversion chrome.
 *
 * @return bool
 */
function ypnus_is_conversion_page() {
	if ( is_admin() || ! is_singular( 'page' ) ) {
		return false;
	}
	if ( is_front_page() ) {
		return true;
	}
	$ids = array( 1829, 1599, 1717, 1715, 1807, 1836, 1835, 1935, 1716 );
	if ( in_array( (int) get_queried_object_id(), $ids, true ) ) {
		return true;
	}
	$slugs = array( 'pricing', 'onboarding', 'getting-started', 'platform', 'about', 'agents', 'thank-you', 'ai-mortgage-loan-leads' );
	return is_page( $slugs );
}

/** Preconnect payment + fonts on pricing/checkout paths. */
add_action(
	'wp_head',
	static function () {
		if ( ! ypnus_is_conversion_page() && ! is_page( 'pricing' ) ) {
			return;
		}
		echo '<link rel="preconnect" href="https://buy.stripe.com" crossorigin />' . "\n";
		echo '<link rel="dns-prefetch" href="//buy.stripe.com" />' . "\n";
	},
	1
);

/**
 * Pricing page: ensure Stripe upgrade links are obvious above the fold in content. Renders
 * from ypn_pricing_tiers()/ypn_stripe_urls() (ypnus-brand-config.php) instead of hardcoding
 * its own copy — a tier with no Stripe URL configured yet (e.g. Growth before its Payment
 * Link is created) is skipped rather than rendering a dead/blank button.
 */
add_filter(
	'the_content',
	static function ( $content ) {
		if ( ! is_page( 1599 ) && ! is_page( 'pricing' ) ) {
			return $content;
		}
		if ( false !== strpos( $content, 'ypnus-pricing-hero-cta' ) ) {
			return $content;
		}
		if ( ! function_exists( 'ypn_pricing_tiers' ) || ! function_exists( 'ypn_stripe_urls' ) ) {
			return $content;
		}

		$tiers        = ypn_pricing_tiers();
		$stripe_urls  = ypn_stripe_urls();
		$paid_order   = array( 'starter', 'growth', 'pro', 'elite' );

		$buttons = '<a href="https://ypnus.com/lo-signup.html" style="background:#2563eb;color:#fff;padding:.55rem 1rem;border-radius:8px;font-weight:700;text-decoration:none" data-ypnus-cta="pricing-hero-free">Start Free</a>';

		foreach ( $paid_order as $tier_id ) {
			$tier = $tiers[ $tier_id ] ?? null;
			$url  = $stripe_urls[ $tier_id ] ?? '';
			if ( ! $tier || '' === $url ) {
				continue; // No Payment Link configured yet for this tier — never render a dead button.
			}
			$is_starter = 'starter' === $tier_id;
			$style      = $is_starter
				? 'background:#c8a84b;color:#09152a;padding:.55rem 1rem;border-radius:8px;font-weight:700;text-decoration:none'
				: 'background:transparent;color:#93c5fd;border:1px solid #475569;padding:.55rem 1rem;border-radius:8px;font-weight:700;text-decoration:none';
			$buttons   .= sprintf(
				' <a href="%s" style="%s" target="_blank" rel="noopener" data-ypnus-cta="pricing-hero-%s">%s %s/mo</a>',
				esc_url( $url ),
				$style,
				esc_attr( $tier_id ),
				esc_html( $tier['label'] ),
				esc_html( $tier['display'] )
			);
		}

		$banner = '<div class="ypnus-pricing-hero-cta" style="margin:0 0 1.5rem;padding:1rem 1.25rem;border-radius:12px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#f8fafc;text-align:center">'
			. '<p style="margin:0 0 .75rem;font-size:1.05rem;font-weight:600">Start free — no credit card. Upgrade when you are ready to lock ZIP territories. 15-day trial on every paid plan.</p>'
			. '<p style="margin:0;display:flex;flex-wrap:wrap;gap:.65rem;justify-content:center">' . $buttons . '</p></div>';
		return $banner . $content;
	},
	8
);
