<?php
/**
 * YPNUS Lead/Profile Auth Guard
 * /ypnus/v1/profile and /ypnus/v1/leads previously required only a
 * guessable lo_id, exposing borrower PII. Full data requires a token
 * (HMAC of lo_id, no DB change) issued on signup. Without a token,
 * /profile returns only the LO's public display name so borrower-facing
 * referral pages (go.html) can greet visitors by it; /leads stays closed.
 */
add_filter('rest_pre_dispatch', function ($result, $server, $request) {
    $route = $request->get_route();
    if ($route !== '/ypnus/v1/profile' && $route !== '/ypnus/v1/leads') {
        return $result;
    }
    $lo_id = (string) $request->get_param('lo_id');
    if ($lo_id === '') {
        return $result;
    }
    $token = (string) $request->get_param('token');
    $expected = hash_hmac('sha256', $lo_id, wp_salt('auth'));
    if ($token !== '' && hash_equals($expected, $token)) {
        return $result;
    }
    if ($route === '/ypnus/v1/profile' && $token === '' && function_exists('ypnus_signup_table_name')) {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                'SELECT first_name, last_name FROM ' . ypnus_signup_table_name() . ' WHERE lo_id = %s LIMIT 1',
                sanitize_text_field($lo_id)
            ),
            ARRAY_A
        );
        if (!$row) {
            return new WP_Error('not_found', 'Account not found.', array('status' => 404));
        }
        return rest_ensure_response(array(
            'first_name' => (string) $row['first_name'],
            'last_name'  => (string) $row['last_name'],
        ));
    }
    return new WP_Error('forbidden', 'Invalid or missing access token.', array('status' => 403));
}, 5, 3);

add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if ($request->get_route() !== '/ypnus/v1/signup') {
        return $response;
    }
    if (!is_object($response) || !method_exists($response, 'get_data')) {
        return $response;
    }
    $data = $response->get_data();
    if (is_array($data) && !empty($data['lo_id'])) {
        $data['token'] = hash_hmac('sha256', (string) $data['lo_id'], wp_salt('auth'));
        $response->set_data($data);
    }
    return $response;
}, 20, 3);
