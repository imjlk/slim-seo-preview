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
npm run build
```

This boots a local `wp-env` site with both plugins mounted and activated.
`env:start` also prepares Composer dependencies and frontend build assets inside the sibling Slim SEO clone when needed.
This repository keeps generated `build/` assets out of Git, so run `npm run build` once before opening the editor UI or `npm run start` for watch mode.

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

Refresh translation files:

```bash
npm run i18n:build
```

Create a WordPress.org submission package with source + build files and without local dev-only dotfiles:

```bash
npm run plugin-zip:org
```

## Release and WordPress.org deployment

GitHub is source-only in this repository. Built assets are generated locally for development and in CI for releases.

### One-time setup

1. Submit the plugin to WordPress.org and wait until the review team gives you the plugin slug and SVN access.
2. In GitHub repository settings, add these Actions secrets:
   - `SVN_USERNAME`
   - `SVN_PASSWORD`
3. If the WordPress.org plugin slug ever differs from this repository name, update the workflow `SLUG` value accordingly.

### Release flow

1. Update the plugin version in `slim-seo-preview.php`.
2. Update `Stable tag` and changelog in `readme.txt`.
3. Commit and push those changes to `main`.
4. Create a GitHub release for the version. Either `0.1.0` or `v0.1.0` works; the workflow strips a leading `v` before deploying to WordPress.org.
5. GitHub Actions will:
   - install dependencies
   - build `build/`
   - validate the package build on every push/PR
   - assemble a WordPress.org-ready package in `artifacts/submission/slim-seo-preview`
   - deploy that package to the WordPress.org SVN repository

### Review workflow

- `submitted-0.1.0` marks the exact code submitted for the initial 0.1.0 review.
- Continue new work on `main`.
- If WordPress.org asks for review fixes before approval, create `review/0.1.0` from `submitted-0.1.0` and keep that branch limited to review blockers.
- After approval, merge or cherry-pick those fixes back into `main`.

### What lands in WordPress.org SVN

The release workflow deploys the packaged output, not the raw Git checkout. That means Git can stay source-only while WordPress.org SVN receives the runnable plugin files required for installation.

## Product scope

MVP intentionally limits inline editing to the `noindex` flag only.

- Title, description, and canonical remain read-only in the panel.
- Schema preview reads the applied frontend output, not unsaved draft changes in the editor.
- Applied schema preview is only available for publicly viewable entries because it fetches the saved frontend HTML.
- Full editing continues in the existing Slim SEO meta box.
