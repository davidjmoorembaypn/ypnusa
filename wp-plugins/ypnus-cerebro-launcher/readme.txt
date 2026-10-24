=== YPN Cerebro Launcher ===
Contributors: ypnusa
Tags: chat, assistant, launcher
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later

Floating "Chat with Cerebro" button for ypnus.com. The chat iframe is not created or loaded until the first click.

== Description ==

Adds a small round launcher button at the bottom-right of the public site. Clicking it opens a panel containing the Cerebro assistant (https://app.ypnus.com/embed/cerebro) in an iframe. On phones the panel becomes a near-full-screen sheet. Escape closes the panel and returns focus to the button. Honors prefers-reduced-motion.

No jQuery, no external requests on page load, no cookies set by this plugin.

Not rendered in wp-admin, the customizer preview, feeds, REST/AJAX requests, or when the URL contains `?nocerebro`.

== Configuration ==

* Disable everywhere: `define( 'YPNUS_CEREBRO_DISABLED', true );` in wp-config.php.
* Change the app origin (e.g. staging): `add_filter( 'ypnus_cerebro_origin', function () { return 'https://staging.example.com'; } );`

Note: the app only allows itself to be framed by https://ypnus.com and https://www.ypnus.com.

== Changelog ==

= 1.0.0 =
* Initial release.
