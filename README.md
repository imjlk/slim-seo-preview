# Slim SEO Preview

Slim SEO Preview is a lightweight companion plugin for [Slim SEO](https://github.com/elightup/slim-seo).

It adds a dedicated Gutenberg plugin sidebar, opened from the top-right toolbar, that:

- shows a visual Google SERP-style preview
- shows a visual Open Graph-style share preview
- shows the full applied JSON-LD schema currently rendered on the saved frontend page
- shows the effective index/noindex state
- allows a quick `noindex` toggle for editable entries directly from the sidebar
- links users back to the existing Slim SEO meta box for full editing

The plugin does not replace Slim SEO's meta box. It is designed as a preview-first companion with one safe quick action.

## Requirements

- WordPress with the block editor
- Slim SEO installed and active
- Node.js 20.18+ for local development

## Local development

This repository expects a sibling clone of Slim SEO:

```text
/workspace/slim-seo-preview
/workspace/slim-seo
```

### First-time setup

```bash
npm install
npm run slim-seo:clone
npm run slim-seo:use:tag -- 4.9.1
npm run env:start
```

This boots a local `wp-env` site with both plugins mounted and activated.
`env:start` also prepares Composer dependencies and frontend build assets inside the sibling Slim SEO clone when needed.

### Switch Slim SEO versions

Use a fixed tag:

```bash
npm run slim-seo:use:tag -- 4.9.1
```

Track upstream `master`:

```bash
npm run slim-seo:use:master
```

Restart `wp-env` after switching:

```bash
npm run env:destroy
npm run env:start
```

### Frontend build loop

```bash
npm run start
```

Create production assets:

```bash
npm run build
```

Create a WordPress.org submission package with source + build files and without local dev-only dotfiles:

```bash
npm run plugin-zip:org
```

## Product scope

MVP intentionally limits inline editing to the `noindex` flag only.

- Title, description, and canonical remain read-only in the panel.
- Schema preview reads the applied frontend output, not unsaved draft changes in the editor.
- Applied schema preview is only available for publicly viewable entries because it fetches the saved frontend HTML.
- Full editing continues in the existing Slim SEO meta box.
