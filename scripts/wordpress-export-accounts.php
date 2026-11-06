<?php
/**
 * READ-ONLY export of YPN USA accounts and ZIP territory locks from WordPress, for the
 * move to the Node.js app. Prints JSON to stdout; changes nothing in WordPress.
 *
 * Run on the WordPress server:
 *   wp eval-file wordpress-export-accounts.php --path="$HOME/domains/ypnus.com/public_html" > ypnus-wp-export.json
 *
 * Then import into the app (dry run first): see scripts/import-wordpress-accounts.ts.
 * The output holds customer emails and Stripe ids, so treat the file as private and
 * delete it after the import.
 */

global $wpdb;

$locks_table = $wpdb->prefix . 'ypnus_territory_locks';
$locks       = array();
if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $locks_table ) ) === $locks_table ) {
	$rows = $wpdb->get_results( "SELECT zip_code, user_id, stripe_subscription_id, tier, locked_at FROM {$locks_table}", ARRAY_A );
	foreach ( (array) $rows as $row ) {
		$locks[] = array(
			'zip'                  => (string) $row['zip_code'],
			'wpUserId'             => (string) $row['user_id'],
			'stripeSubscriptionId' => (string) $row['stripe_subscription_id'],
			'tier'                 => (string) $row['tier'],
			'lockedAt'             => (string) $row['locked_at'],
		);
	}
}

$users = array();
foreach ( get_users( array( 'fields' => array( 'ID', 'user_email', 'display_name', 'user_registered' ) ) ) as $user ) {
	$users[] = array(
		'wpUserId'             => (string) $user->ID,
		'email'                => (string) $user->user_email,
		'name'                 => (string) $user->display_name,
		'registeredAt'         => (string) $user->user_registered,
		'isAdmin'              => user_can( $user->ID, 'manage_options' ),
		'tier'                 => (string) get_user_meta( $user->ID, 'ypnus_tier', true ),
		'subscriptionStatus'   => (string) get_user_meta( $user->ID, 'ypnus_subscription_status', true ),
		'stripeCustomerId'     => (string) get_user_meta( $user->ID, 'ypnus_stripe_customer_id', true ),
		'stripeSubscriptionId' => (string) get_user_meta( $user->ID, 'ypnus_stripe_subscription_id', true ),
	);
}

echo wp_json_encode(
	array(
		'exportedAt' => gmdate( 'c' ),
		'users'      => $users,
		'zipLocks'   => $locks,
	),
	JSON_PRETTY_PRINT
);
