<?php
/**
 * Plugin Name: YPN USA Brand Config
 * Description: Single source of truth for brand, pricing, and SEO constants.
 * Version: 2.3.0
 *
 * NOT YET DEPLOYED. This is a prepared replacement for the live 2.2.0 version of this exact
 * file (wp-content/mu-plugins/ypnus-brand-config.php) — see wp-mu-plugins/README.md.
 *
 * CHANGES FROM LIVE 2.2.0, per the canonical five-tier commercial model (matches
 * app.ypnus.com's src/lib/pricing.ts exactly):
 *   - ypn_pricing_tiers() gains 'growth' ($99) between starter and pro.
 *   - Pro corrected from $99.99 -> $199. Elite corrected from $299.99 -> $299 (whole dollars,
 *     matching the app-side canonical prices).
 *   - ypn_trial_config()'s paid_stripe_trial_days corrected from 0 -> 15. The old
 *     "14-day free-account Pro feature preview" mechanism (pro_preview_days /
 *     pro_preview_features) is retired — free is Cerebro-only now, not a temporary taste of
 *     Pro. See the doc comment on ypn_trial_config() below for what replaces it.
 *   - ypn_normalize_brand()'s '<th>Growth</th>' => '<th>Pro</th>' rule is REMOVED. That rule
 *     predates Growth being a real tier and would otherwise silently rewrite it back to Pro
 *     everywhere it appears.
 *   - ypn_stripe_urls() gains a 'growth' key. NO REAL VALUE IS SET — left as '' with a loud
 *     comment. A real Stripe Payment Link must be created in the Dashboard and set via the
 *     ypnus_stripe_urls option (or wp-config.php override) before Growth can be purchased.
 *     This file never invents a Stripe URL.
 */
defined( 'ABSPATH' ) || exit;

if ( ! defined( 'YPN_BRAND' ) ) {
	define( 'YPN_BRAND', 'YPN USA' );
}
if ( ! defined( 'YPN_BRAND_SHORT' ) ) {
	define( 'YPN_BRAND_SHORT', 'YPN USA' );
}
if ( ! defined( 'YPN_DOMAIN' ) ) {
	define( 'YPN_DOMAIN', 'ypnus.com' );
}
if ( ! defined( 'YPN_SITE_URL' ) ) {
	define( 'YPN_SITE_URL', 'https://ypnus.com' );
}
if ( ! defined( 'YPN_NMLS' ) ) {
	define( 'YPN_NMLS', '787257' );
}
if ( ! defined( 'YPN_SUPPORT_EMAIL' ) ) {
	define( 'YPN_SUPPORT_EMAIL', 'support@ypnus.com' );
}
if ( ! defined( 'YPN_PHONE' ) ) {
	define( 'YPN_PHONE', '559-512-0372' );
}
/** Optional — free at https://api.census.gov/data/key_signup.html — upgrades ZIP demand to live ACS data. */
if ( ! defined( 'YPN_CENSUS_API_KEY' ) ) {
	define( 'YPN_CENSUS_API_KEY', '' );
}

/**
 * Pricing tiers — amounts in USD per month. Canonical five-tier model: free/starter/growth/
 * pro/elite, matching app.ypnus.com's src/lib/pricing.ts exactly. Every paid tier includes
 * exactly 1 exclusive ZIP; higher tiers buy automation/capability, not more ZIPs. Additional
 * ZIPs are a separate paid add-on (not modeled here yet).
 *
 * @return array<string, array<string, string>>
 */
function ypn_pricing_tiers(): array {
	return array(
		'free'    => array(
			'label'   => 'Free',
			'amount'  => '0',
			'display' => '$0',
		),
		'starter' => array(
			'label'   => 'Starter',
			'amount'  => '29.99',
			'display' => '$29.99',
		),
		'growth'  => array(
			'label'   => 'Growth',
			'amount'  => '99',
			'display' => '$99',
		),
		'pro'     => array(
			'label'   => 'Pro',
			'amount'  => '199',
			'display' => '$199',
		),
		'elite'   => array(
			'label'   => 'Elite',
			'amount'  => '299',
			'display' => '$299',
		),
	);
}

/**
 * Canonical Stripe checkout URLs — single source of truth sitewide.
 *
 * @return array<string, string>
 */
function ypn_stripe_urls(): array {
	$defaults = array(
		'starter'        => 'https://buy.stripe.com/dRmaEZ9e9fWG9qs9T133W00',
		// NOT SET. Create a Growth Payment Link in the Stripe Dashboard (metadata
		// ypnus_tier=growth, see wp-plugins/ypnus-stripe-webhook/README.md) and set its URL
		// here or via the ypnus_stripe_urls option — never invent one.
		'growth'         => '',
		'pro'            => 'https://buy.stripe.com/6oU7sN61X6m66egaX533W01',
		'elite'          => 'https://buy.stripe.com/cNicN7fCx11MbyAd5d33W02',
		'dfy'            => 'https://buy.stripe.com/cNifZj0HDfWG7ik4yH33W03',
		'billing_portal' => 'https://billing.stripe.com/p/login/7sY00j33jgBO1UZ8282Fa00',
	);
	$custom = get_option( 'ypnus_stripe_urls', array() );
	if ( ! is_array( $custom ) ) {
		return $defaults;
	}
	return array_merge( $defaults, array_filter( $custom, 'is_string' ) );
}

/**
 * Annual Stripe checkout links — override via ypnus_stripe_annual_urls option.
 *
 * @return array<string, string>
 */
function ypn_stripe_annual_urls(): array {
	$monthly  = ypn_stripe_urls();
	$defaults = array(
		'starter' => $monthly['starter'] ?? '',
		'growth'  => $monthly['growth'] ?? '',
		'pro'     => $monthly['pro'] ?? '',
		'elite'   => $monthly['elite'] ?? '',
	);
	$custom = get_option( 'ypnus_stripe_annual_urls', array() );
	if ( ! is_array( $custom ) ) {
		return $defaults;
	}
	return array_merge( $defaults, array_filter( $custom, 'is_string' ) );
}

/**
 * PayPal checkout — enable via ypnus_paypal_enabled + ypnus_paypal_urls options.
 *
 * @return array<string, mixed>
 */
function ypn_paypal_config(): array {
	$urls = get_option( 'ypnus_paypal_urls', array() );
	if ( ! is_array( $urls ) ) {
		$urls = array();
	}
	return array(
		'enabled' => (bool) get_option( 'ypnus_paypal_enabled', false ),
		'urls'    => array_merge(
			array(
				'starter' => '',
				'growth'  => '',
				'pro'     => '',
				'elite'   => '',
				'dfy'     => '',
			),
			array_filter( $urls, 'is_string' )
		),
		'note'    => 'Set ypnus_paypal_enabled=1 and ypnus_paypal_urls in wp option when PayPal buttons are live.',
	);
}

/**
 * Free-account and paid-trial rules.
 *
 * Canonical model: Free is Cerebro + the growth diagnostic only — never a temporary preview
 * of a paid tier's features, and never itself a "trial" (there is nothing to convert away
 * from; a Free account simply stays Free until someone picks a paid plan). Every PAID tier
 * gets the same 15-day trial, asserted via Stripe (ypnus_trialing=true Payment Link metadata
 * — see wp-plugins/ypnus-stripe-webhook/README.md) and surfaced to app.ypnus.com through the
 * SSO handoff's trialEndsAt claim (ypnus-app-sso.php + ypnus-lo-account-bridge.php).
 *
 * REMOVED from the live 2.2.0 config: pro_preview_days / pro_preview_features (the old
 * "14-day free-account Pro feature preview"). That mechanism never actually gated anything
 * server-side and conflicted with the canonical model's "Free has no paid capability at
 * all" rule — retired outright rather than reconciled.
 *
 * @return array<string, mixed>
 */
function ypn_trial_config(): array {
	$custom = get_option( 'ypnus_trial_config', array() );
	if ( ! is_array( $custom ) ) {
		$custom = array();
	}
	return array_merge(
		array(
			'free_account'           => true,
			'free_card_required'     => false,
			'free_path'              => '/lo-signup.html',
			'paid_stripe_trial_days' => 15,
			'downsell_on_exit'       => true,
			'copy'                   => array(
				'free' => 'No credit card — run Cerebro and see your growth diagnostic before you pay anything.',
				'paid' => '15-day free trial on every paid plan. Bills via Stripe after; cancel anytime in the billing portal.',
			),
		),
		$custom
	);
}

/**
 * Payment plan catalog — monthly + annual.
 *
 * @return array<string, mixed>
 */
function ypn_payment_plans(): array {
	$tiers   = ypn_pricing_tiers();
	$monthly = ypn_stripe_urls();
	$annual  = ypn_stripe_annual_urls();
	$paypal  = ypn_paypal_config();

	$plans = array();
	foreach ( array( 'starter', 'growth', 'pro', 'elite' ) as $tier ) {
		$amount         = (float) ( $tiers[ $tier ]['amount'] ?? 0 );
		$plans[ $tier ] = array(
			'label'   => $tiers[ $tier ]['label'] ?? ucfirst( $tier ),
			'monthly' => array(
				'display' => $tiers[ $tier ]['display'] ?? '',
				'amount'  => $amount,
				'stripe'  => $monthly[ $tier ] ?? '',
				'paypal'  => $paypal['urls'][ $tier ] ?? '',
			),
			'annual'  => array(
				'display'       => '$' . number_format( round( $amount * 12 * 0.85, 2 ), 2 ) . '/yr',
				'amount'        => round( $amount * 12 * 0.85, 2 ),
				'monthly_equiv' => '$' . number_format( round( $amount * 0.85, 2 ), 2 ) . '/mo',
				'discount_pct'  => 15,
				'stripe'        => $annual[ $tier ] ?? ( $monthly[ $tier ] ?? '' ),
				'paypal'        => $paypal['urls'][ $tier ] ?? '',
			),
		);
	}

	return array(
		'default_period' => 'monthly',
		'annual_enabled' => (bool) get_option( 'ypnus_annual_billing_enabled', false ),
		'plans'          => $plans,
		'one_time'       => array(
			'dfy' => array(
				'display' => '$49.99',
				'stripe'  => $monthly['dfy'] ?? '',
				'paypal'  => $paypal['urls']['dfy'] ?? '',
			),
		),
		'billing_portal' => $monthly['billing_portal'] ?? '',
	);
}

/**
 * Alias used by chatbot and persuasion modules.
 *
 * @return array<string, string>
 */
function ypnus_stripe_checkout_urls(): array {
	return ypn_stripe_urls();
}

/**
 * Core funnel URLs for CTAs, chatbot routing, and REST config.
 *
 * @return array<string, string>
 */
function ypn_funnel_urls(): array {
	return array(
		'home'            => home_url( '/' ),
		'check_zip'       => home_url( '/check-zip.html' ),
		'signup'          => home_url( '/lo-signup.html' ),
		'pricing'         => home_url( '/pricing.html' ),
		'onboarding'      => home_url( '/onboarding.html' ),
		'dashboard'       => home_url( '/lo-dashboard.html' ),
		'realtor'         => home_url( '/realtor-partner.html' ),
		'gbp'             => home_url( '/gbp-setup.html' ),
		'website_builder' => home_url( '/lo-website-builder.html' ),
	);
}

function ypn_pricing_seo(): array {
	$tiers = ypn_pricing_tiers();
	return array(
		'title'       => sprintf(
			'%s Pricing — Starter %s/mo, Growth %s/mo, Pro %s/mo, Elite %s/mo',
			YPN_BRAND,
			$tiers['starter']['display'],
			$tiers['growth']['display'],
			$tiers['pro']['display'],
			$tiers['elite']['display']
		),
		'description' => sprintf(
			'%s pricing for loan officers. Free Cerebro diagnostic, then Starter %s/mo, Growth %s/mo, Pro %s/mo, or Elite %s/mo — 15-day trial on every paid plan, 1 exclusive ZIP included.',
			YPN_BRAND,
			$tiers['starter']['display'],
			$tiers['growth']['display'],
			$tiers['pro']['display'],
			$tiers['elite']['display']
		),
	);
}

/**
 * Normalize legacy brand strings to YPN USA.
 *
 * NOTE: the live 2.2.0 version of this function contained a
 * '<th>Growth</th>' => '<th>Pro</th>' replacement. That rule is REMOVED here — it predates
 * Growth being a real tier and would otherwise silently rewrite it back to Pro sitewide.
 */
function ypn_normalize_brand( string $text ): string {
	$replacements = array(
		'YPN Business'                                => YPN_BRAND,
		'YPN AI'                                       => YPN_BRAND,
		'YPNUS Platform'                                => YPN_BRAND . ' Platform',
		'Ypnus'                                         => YPN_BRAND,
		'Business $99.99/mo'                            => 'Elite $299/mo',
		'Start Business'                                => 'Start Elite',
		'Upgrade to Pro or Business'                    => 'Upgrade to Pro or Elite',
		'pricing-hero-business'                         => 'pricing-hero-elite',
		'stripe-business-btn'                           => 'stripe-elite-btn',
		'class="yp-card-name">Business<'                => 'class="yp-card-name">Elite<',
		'class="plan-name" itemprop="name">Business<'   => 'class="plan-name" itemprop="name">Elite<',
		'<th>Business</th>'                             => '<th>Elite</th>',
		'| YPN USA | YPN USA'                           => '| ' . YPN_BRAND,
	);
	$text = str_replace( array_keys( $replacements ), array_values( $replacements ), $text );
	// Standalone YPNUS in prose — never touch JS identifiers like YPNUS_PERSUASION.
	$text = preg_replace( '/\bYPNUS\b(?!_)/', YPN_BRAND, $text );
	// Domain slug in prose only — skip URLs, emails, and HTML/CSS identifiers (ypnus-* tokens).
	$text = preg_replace(
		'/(?<!\/)(?<!@)(?<!#)(?<!["\'=:.-])\bypnus\b(?!\.com)(?!-)/i',
		'ypnus.com',
		$text
	);
	return $text;
}

/**
 * Sitewide legacy tier + brand purge on rendered HTML.
 */
add_filter(
	'the_content',
	static function ( $content ) {
		if ( is_admin() ) {
			return $content;
		}
		return ypn_normalize_brand( (string) $content );
	},
	5
);

add_filter(
	'document_title_parts',
	static function ( $parts ) {
		if ( ! empty( $parts['title'] ) ) {
			$parts['title'] = ypn_normalize_brand( (string) $parts['title'] );
		}
		return $parts;
	},
	20
);

/**
 * Final HTML pass — catches Elementor/widgets/cache that skip the_content.
 */
add_action(
	'template_redirect',
	static function () {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return;
		}
		ob_start(
			static function ( $html ) {
				if ( ! is_string( $html ) || $html === '' ) {
					return $html;
				}
				return ypn_normalize_brand( $html );
			}
		);
	},
	0
);
