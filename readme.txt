=== Slim SEO Preview ===
Contributors: imjlk
Requires at least: 6.5
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Tags: seo, gutenberg, schema, open graph, preview

Slim SEO Preview adds a dedicated Gutenberg sidebar for Slim SEO with SERP, Open Graph, and applied schema previews.

== Description ==

Slim SEO Preview is a companion plugin for Slim SEO.

It adds a dedicated Gutenberg plugin sidebar, opened from the top-right toolbar, that:

* shows a visual Google SERP-style preview
* shows a visual Open Graph-style share preview
* shows the full applied JSON-LD schema currently rendered on the saved frontend page
* shows the effective index/noindex state
* allows a quick noindex toggle for editable entries directly from the sidebar
* links users back to the existing Slim SEO meta box for full editing

The plugin does not replace Slim SEO's meta box. It is designed as a preview-first companion with one safe quick action.

Applied schema preview reads the saved frontend output. Unsaved draft changes are not included.

== Installation ==

1. Install and activate Slim SEO.
2. Upload this plugin to `/wp-content/plugins/` or install it through the Plugins screen.
3. Activate `Slim SEO Preview`.
4. Open the block editor for a public post type entry.
5. Use the `Slim SEO Preview` button near the top-right toolbar to open the sidebar.

== Frequently Asked Questions ==

= Does this replace the Slim SEO meta box? =

No. Full editing still happens in the existing Slim SEO meta box.

= Can I edit the SEO title and description from the sidebar? =

Not in the current MVP. The sidebar is preview-first and only exposes a quick noindex toggle.

= Why is schema preview unavailable for some entries? =

Applied schema preview reads the saved frontend HTML, so it only works for publicly viewable entries.

== Changelog ==

= 0.1.0 =

* Initial release.
