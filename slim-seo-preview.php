<?php
/**
 * Plugin Name:       Slim SEO Preview
 * Description:       Adds Gutenberg SERP, Open Graph, and applied schema previews for Slim SEO with a quick noindex toggle.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Requires Plugins:  slim-seo
 * Author:            imjlk
 * License:           GPL-2.0-or-later
 * Text Domain:       slim-seo-preview
 * Domain Path:       /languages
 */

declare(strict_types=1);

namespace SlimSeoPreview;

defined( 'ABSPATH' ) || exit;

define( 'SLIM_SEO_PREVIEW_FILE', __FILE__ );
define( 'SLIM_SEO_PREVIEW_DIR', plugin_dir_path( __FILE__ ) );
define( 'SLIM_SEO_PREVIEW_URL', plugin_dir_url( __FILE__ ) );
define( 'SLIM_SEO_PREVIEW_VER', '0.1.0' );

require_once SLIM_SEO_PREVIEW_DIR . 'src/Editor.php';

Editor::setup();
