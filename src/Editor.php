<?php

declare(strict_types=1);

namespace SlimSeoPreview;

defined( 'ABSPATH' ) || exit;

use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

final class Editor {
	public static function setup(): void {
		add_action( 'admin_notices', [ __CLASS__, 'maybe_render_dependency_notice' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_assets' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function maybe_render_dependency_notice(): void {
		$screen = self::get_editor_screen();
		if ( ! $screen || self::is_slim_seo_active() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'Slim SEO Preview requires Slim SEO to be installed and active.', 'slim-seo-preview' )
		);
	}

	public static function enqueue_assets(): void {
		if ( ! self::is_slim_seo_active() ) {
			return;
		}

		$screen = self::get_editor_screen();
		if ( ! $screen ) {
			return;
		}

		$asset_file = SLIM_SEO_PREVIEW_DIR . 'build/index.asset.php';
		$script_file = SLIM_SEO_PREVIEW_DIR . 'build/index.js';
		if ( ! file_exists( $asset_file ) || ! file_exists( $script_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'slim-seo-preview',
			SLIM_SEO_PREVIEW_URL . 'build/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( 'slim-seo-preview', 'slim-seo-preview' );

		$style_file = SLIM_SEO_PREVIEW_DIR . 'build/style-index.css';
		if ( file_exists( $style_file ) ) {
			wp_enqueue_style(
				'slim-seo-preview',
				SLIM_SEO_PREVIEW_URL . 'build/style-index.css',
				[],
				filemtime( $style_file )
			);
		}

		$post_type_object = get_post_type_object( $screen->post_type );
		$can_edit = $post_type_object && ! empty( $post_type_object->cap->edit_posts )
			? current_user_can( $post_type_object->cap->edit_posts )
			: current_user_can( 'edit_posts' );

		wp_add_inline_script(
			'slim-seo-preview',
			'window.SlimSeoPreview = ' . wp_json_encode(
				[
					'metaboxId'             => 'slim-seo',
					'postType'              => $screen->post_type,
					'slimSeoActive'         => true,
					'canEditPosts'          => $can_edit,
					'isPublicPostType'      => true,
					'siteName'              => get_bloginfo( 'name' ),
					'homeUrl'               => home_url( '/' ),
					'strings'               => [
						'dependencyNotice'      => __( 'Slim SEO Preview requires Slim SEO to stay active.', 'slim-seo-preview' ),
						'readOnlyPermission'    => __( 'You do not have permission to update SEO settings for this item.', 'slim-seo-preview' ),
						'restError'             => __( 'Slim SEO Preview could not load Slim SEO data. The existing Slim SEO meta box remains available below.', 'slim-seo-preview' ),
						'globalNoindex'         => __( 'This post type is globally set to noindex in Slim SEO, so the per-post toggle is locked here.', 'slim-seo-preview' ),
						'jumpToMetabox'         => __( 'Jump to Slim SEO meta box', 'slim-seo-preview' ),
						'metaboxMissing'        => __( 'The Slim SEO meta box could not be found on this screen.', 'slim-seo-preview' ),
					],
				]
			) . ';',
			'before'
		);
	}

	private static function is_slim_seo_active(): bool {
		return defined( 'SLIM_SEO_VER' );
	}

	private static function is_public_post_type( string $post_type ): bool {
		$post_type_object = get_post_type_object( $post_type );
		return (bool) ( $post_type_object && $post_type_object->public );
	}

	public static function register_routes(): void {
		register_rest_route(
			'slim-seo-preview/v1',
			'/post/(?P<id>\d+)/noindex',
			[
				'args' => self::get_post_route_args(),
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_noindex_state' ],
					'permission_callback' => [ __CLASS__, 'can_edit_post' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_noindex_state' ],
					'permission_callback' => [ __CLASS__, 'can_edit_post' ],
					'args'                => [
						'noindex' => [
							'type'     => 'boolean',
							'required' => true,
						],
					],
				],
			]
		);

		register_rest_route(
			'slim-seo-preview/v1',
			'/post/(?P<id>\d+)/schema',
			[
				'args' => self::get_post_route_args(),
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_schema_preview' ],
					'permission_callback' => [ __CLASS__, 'can_edit_post' ],
				],
			]
		);
	}

	public static function can_edit_post( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( $post_id <= 0 ) {
			return new WP_Error(
				'slim_seo_preview_invalid_post_id',
				__( 'A valid post ID is required.', 'slim-seo-preview' ),
				[ 'status' => 400 ]
			);
		}

		if ( ! get_post( $post_id ) ) {
			return new WP_Error(
				'slim_seo_preview_invalid_post',
				__( 'The requested post could not be found.', 'slim-seo-preview' ),
				[ 'status' => 404 ]
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error(
				'slim_seo_preview_forbidden',
				__( 'You are not allowed to preview or update SEO data for this post.', 'slim-seo-preview' ),
				[ 'status' => 403 ]
			);
		}

		return true;
	}

	public static function get_noindex_state( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! self::is_slim_seo_active() ) {
			return new WP_Error(
				'slim_seo_preview_missing_dependency',
				__( 'Slim SEO must be active to read noindex state.', 'slim-seo-preview' ),
				[ 'status' => 412 ]
			);
		}

		return rest_ensure_response( self::build_noindex_state( $post_id ) );
	}

	public static function update_noindex_state( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		if ( ! self::is_slim_seo_active() ) {
			return new WP_Error(
				'slim_seo_preview_missing_dependency',
				__( 'Slim SEO must be active to update noindex state.', 'slim-seo-preview' ),
				[ 'status' => 412 ]
			);
		}

		$data = get_post_meta( $post_id, 'slim_seo', true );
		$data = is_array( $data ) ? $data : [];

		$noindex = (bool) $request->get_param( 'noindex' );
		if ( $noindex ) {
			$data['noindex'] = 1;
		} else {
			unset( $data['noindex'] );
		}

		if ( empty( $data ) ) {
			delete_post_meta( $post_id, 'slim_seo' );
		} else {
			update_post_meta( $post_id, 'slim_seo', $data );
		}

		return rest_ensure_response( self::build_noindex_state( $post_id ) );
	}

	public static function get_schema_preview( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );

		if ( ! self::is_slim_seo_active() ) {
			return new WP_Error(
				'slim_seo_preview_missing_dependency',
				__( 'Slim SEO must be active to read schema preview data.', 'slim-seo-preview' ),
				[ 'status' => 412 ]
			);
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new WP_Error(
				'slim_seo_preview_invalid_post',
				__( 'The requested post could not be found.', 'slim-seo-preview' ),
				[ 'status' => 404 ]
			);
		}

		if ( ! is_post_publicly_viewable( $post ) ) {
			return new WP_Error(
				'slim_seo_preview_unavailable_for_non_public_posts',
				__(
					'Applied schema preview is only available for publicly viewable entries because it reads the saved frontend HTML.',
					'slim-seo-preview'
				),
				[ 'status' => 409 ]
			);
		}

		$url = self::get_schema_source_url( $post_id );
		if ( ! $url ) {
			return new WP_Error(
				'slim_seo_preview_missing_url',
				__( 'Slim SEO Preview could not determine a frontend URL for this entry.', 'slim-seo-preview' ),
				[ 'status' => 409 ]
			);
		}

		$response     = null;
		$status_code  = 0;
		$last_error   = '';
		$request_urls = self::get_schema_request_urls( $url );
		$host_header  = self::get_loopback_host_header( $url );

		foreach ( $request_urls as $request_url ) {
			$headers = [
				'Accept' => 'text/html,application/xhtml+xml',
			];

			if ( $host_header && self::should_forward_host_header( $url, $request_url ) ) {
				$headers['Host'] = $host_header;
			}

			$response = wp_remote_get(
				$request_url,
				[
					'timeout'     => 15,
					'redirection' => 5,
					'user-agent'  => 'Slim SEO Preview/' . SLIM_SEO_PREVIEW_VER,
					'headers'     => $headers,
				]
			);

			if ( is_wp_error( $response ) ) {
				$last_error = $response->get_error_message();
				continue;
			}

			$status_code = (int) wp_remote_retrieve_response_code( $response );
			if ( $status_code >= 200 && $status_code < 300 ) {
				break;
			}

			$last_error = sprintf(
				/* translators: %d: HTTP status code. */
				__( 'Slim SEO Preview could not load the rendered page. HTTP %d was returned.', 'slim-seo-preview' ),
				$status_code
			);
		}

		if ( is_wp_error( $response ) || ! $response || $status_code < 200 || $status_code >= 300 ) {
			return new WP_Error(
				'slim_seo_preview_fetch_failed',
				$last_error ?: __( 'Slim SEO Preview could not load the rendered page.', 'slim-seo-preview' ),
				[ 'status' => 502 ]
			);
		}

		$scripts = self::extract_json_ld_scripts( (string) wp_remote_retrieve_body( $response ) );

		return rest_ensure_response(
			[
				'url'         => esc_url_raw( $url ),
				'fetchedAt'   => gmdate( 'c' ),
				'scriptCount' => count( $scripts ),
				'entityCount' => array_sum( array_column( $scripts, 'entityCount' ) ),
				'scripts'     => $scripts,
			]
		);
	}

	private static function build_noindex_state( int $post_id ): array {
		$post_type = get_post_type( $post_id );
		$options   = get_option( 'slim_seo', [] );
		$post_meta = get_post_meta( $post_id, 'slim_seo', true );
		$post_meta = is_array( $post_meta ) ? $post_meta : [];

		$post_type_options = is_string( $post_type ) && isset( $options[ $post_type ] ) && is_array( $options[ $post_type ] )
			? $options[ $post_type ]
			: [];
		$post_type_noindex = (bool) ( $post_type_options['noindex'] ?? false );
		$post_noindex      = (bool) ( $post_meta['noindex'] ?? false );

		return [
			'postNoindex'      => $post_noindex,
			'postTypeNoindex'  => $post_type_noindex,
			'effectiveNoindex' => $post_noindex || $post_type_noindex,
		];
	}

	private static function get_schema_source_url( int $post_id ): string {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return '';
		}

		$url = get_permalink( $post );
		return is_string( $url ) ? $url : '';
	}

	private static function get_editor_screen() {
		if ( ! function_exists( 'get_current_screen' ) ) {
			return null;
		}

		$screen = get_current_screen();
		if ( ! $screen || empty( $screen->post_type ) ) {
			return null;
		}

		if ( ! self::is_public_post_type( $screen->post_type ) ) {
			return null;
		}

		if ( method_exists( $screen, 'is_block_editor' ) && ! $screen->is_block_editor() ) {
			return null;
		}

		return $screen;
	}

	private static function get_post_route_args(): array {
		return [
			'id' => [
				'description'       => __( 'The post ID for the current editor entry.', 'slim-seo-preview' ),
				'type'              => 'integer',
				'required'          => true,
				'sanitize_callback' => 'absint',
				'validate_callback' => static function ( $value ): bool {
					return absint( $value ) > 0;
				},
			],
		];
	}

	private static function get_schema_request_urls( string $url ): array {
		$timestamp    = rawurlencode( (string) time() );
		$request_urls = [
			self::append_query_arg( $url, 'ssp_schema_preview=' . $timestamp ),
		];

		$parsed = wp_parse_url( $url );
		if ( ! is_array( $parsed ) || empty( $parsed['host'] ) ) {
			return $request_urls;
		}

		$host = (string) $parsed['host'];
		if ( ! self::should_use_internal_request_url( $host ) ) {
			return $request_urls;
		}

		$internal_url = self::get_internal_request_base_url() . ( $parsed['path'] ?? '/' );
		if ( '' === $internal_url ) {
			return $request_urls;
		}

		if ( ! empty( $parsed['query'] ) ) {
			$internal_url .= '?' . $parsed['query'];
		}

		return [
			self::append_query_arg( $internal_url, 'ssp_schema_preview=' . $timestamp ),
		];
	}

	private static function get_loopback_host_header( string $url ): string {
		$parsed = wp_parse_url( $url );
		if ( ! is_array( $parsed ) || empty( $parsed['host'] ) ) {
			return '';
		}

		$host = (string) $parsed['host'];
		$port = isset( $parsed['port'] ) ? (int) $parsed['port'] : 0;

		return $port > 0 ? $host . ':' . $port : $host;
	}

	private static function should_use_internal_request_url( string $host ): bool {
		if ( 'localhost' === $host ) {
			return true;
		}

		if ( false === filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return false;
		}

		return false === filter_var(
			$host,
			FILTER_VALIDATE_IP,
			FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
		);
	}

	private static function get_internal_request_base_url(): string {
		$scheme = is_ssl() ? 'https' : 'http';

		return sprintf( '%s://localhost', $scheme );
	}

	private static function should_forward_host_header( string $source_url, string $request_url ): bool {
		$source_host = self::get_loopback_host_header( $source_url );
		$request_host = self::get_loopback_host_header( $request_url );

		return '' !== $source_host && '' !== $request_host && $source_host !== $request_host;
	}

	private static function append_query_arg( string $url, string $query ): string {
		return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . $query;
	}

	private static function extract_json_ld_scripts( string $html ): array {
		$matches = [];
		if ( ! preg_match_all( '/<script\b(?=[^>]*\btype=(["\'])application\/ld\+json\1)([^>]*)>(.*?)<\/script>/is', $html, $matches, PREG_SET_ORDER ) ) {
			return [];
		}

		$scripts = [];
		foreach ( $matches as $index => $match ) {
			$attributes = isset( $match[2] ) ? (string) $match[2] : '';
			$raw_json   = isset( $match[3] ) ? trim( html_entity_decode( (string) $match[3], ENT_QUOTES | ENT_HTML5 ) ) : '';
			$raw_json   = preg_replace( '/^\s*<!--|-->\s*$/', '', $raw_json ) ?? $raw_json;
			$raw_json   = trim( $raw_json );
			$id         = '';

			if ( preg_match( '/\bid=(["\'])(.*?)\1/i', $attributes, $id_match ) ) {
				$id = sanitize_text_field( $id_match[2] );
			}

			$decoded   = json_decode( $raw_json, true );
			$is_valid  = JSON_ERROR_NONE === json_last_error();
			$types     = $is_valid ? self::extract_schema_types( $decoded ) : [];
			$pretty    = $is_valid ? wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) : '';
			$label     = self::build_schema_label( $index + 1, $id, $types );
			$entity_count = $is_valid ? self::count_schema_entities( $decoded ) : 0;

			$scripts[] = [
				'index'       => $index + 1,
				'id'          => $id,
				'label'       => $label,
				'isSlimSeo'   => 'slim-seo-schema' === $id,
				'isValid'     => $is_valid,
				'entityCount' => $entity_count,
				'types'       => $types,
				'rawJson'     => $raw_json,
				'prettyJson'  => $pretty ?: $raw_json,
			];
		}

		return $scripts;
	}

	private static function build_schema_label( int $index, string $id, array $types ): string {
		if ( $id ) {
			return '#' . $id;
		}

		if ( ! empty( $types ) ) {
			return implode( ', ', array_slice( $types, 0, 2 ) );
		}

		return sprintf(
			/* translators: %d: script index. */
			__( 'JSON-LD Script %d', 'slim-seo-preview' ),
			$index
		);
	}

	private static function count_schema_entities( $decoded ): int {
		if ( ! is_array( $decoded ) ) {
			return 0;
		}

		if ( isset( $decoded['@graph'] ) && is_array( $decoded['@graph'] ) ) {
			return count( $decoded['@graph'] );
		}

		if ( self::is_list_array( $decoded ) ) {
			return count( $decoded );
		}

		return empty( $decoded ) ? 0 : 1;
	}

	private static function extract_schema_types( $decoded ): array {
		if ( ! is_array( $decoded ) ) {
			return [];
		}

		$types = [];

		if ( isset( $decoded['@graph'] ) && is_array( $decoded['@graph'] ) ) {
			foreach ( $decoded['@graph'] as $item ) {
				$types = array_merge( $types, self::extract_schema_types( $item ) );
			}
		} elseif ( self::is_list_array( $decoded ) ) {
			foreach ( $decoded as $item ) {
				$types = array_merge( $types, self::extract_schema_types( $item ) );
			}
		} elseif ( isset( $decoded['@type'] ) ) {
			$raw_types = is_array( $decoded['@type'] ) ? $decoded['@type'] : [ $decoded['@type'] ];
			foreach ( $raw_types as $type ) {
				if ( is_string( $type ) && '' !== $type ) {
					$types[] = sanitize_text_field( $type );
				}
			}
		}

		return array_values( array_unique( $types ) );
	}

	private static function is_list_array( array $value ): bool {
		$index = 0;
		foreach ( array_keys( $value ) as $key ) {
			if ( $index !== $key ) {
				return false;
			}
			$index++;
		}

		return true;
	}
}
