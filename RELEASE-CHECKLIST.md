# Release Checklist

This repository treats GitHub as source-only and WordPress.org SVN as the release target.

## Submission Baseline

- `b156b30` is the exact 0.1.0 submission baseline.
- Preserve it with the annotated tag `submitted-0.1.0`.
- Keep `main` as the ongoing stabilization line for 0.1.1 and later.

## Review Response Workflow

- If WordPress.org review feedback is listing-only or documentation-only, respond without changing the submitted code baseline.
- If review feedback requires code changes before approval:
  - branch from `submitted-0.1.0` into `review/0.1.0`
  - fix only the review blocker there
  - rebuild the review zip from that branch
- If a needed fix already exists on `main`, cherry-pick it into `review/0.1.0` instead of re-implementing it.
- After approval, merge or cherry-pick any review fixes back into `main` before the 0.1.1 release.

## Manual QA Matrix

Run these checks before cutting any review zip or release zip:

- Slim SEO active:
  - plugin sidebar loads in the block editor
  - previews render without fatal errors or broken requests
- Slim SEO inactive:
  - dependency notice appears
  - sidebar assets do not break the editor
- Publicly viewable entry:
  - schema preview loads saved frontend JSON-LD
- Non-public or non-viewable entry:
  - schema preview explains why it is unavailable
- Entry with schema:
  - summary cards show entity counts and readable entity details
- Entry without schema:
  - empty-state notice is shown
- Entry with multiple JSON-LD entities:
  - each entity is listed with readable facts
- Metabox edits without save:
  - title, description, canonical, and image changes are reflected in the preview sidebar
- Quick noindex toggle:
  - sidebar state updates
  - Slim SEO metabox state stays in sync
- Korean locale:
  - PHP strings load translated text
  - JavaScript sidebar strings load translated text

## Build and Packaging

- `npm ci`
- `npm run build`
- `npm run i18n:build`
- `npm run plugin-zip:org`
- Verify the package contains:
  - `slim-seo-preview.php`
  - `build/`
  - `src/`
  - `languages/`
  - `readme.txt`

## Versioning

- Keep the source version unchanged while waiting for review unless a review fix requires a new package.
- When cutting 0.1.1 or later:
  - update `Version` in `slim-seo-preview.php`
  - update `Stable tag` in `readme.txt`
  - add matching changelog entries

## WordPress.org Release Flow

- Confirm WordPress.org SVN credentials are stored as `SVN_USERNAME` and `SVN_PASSWORD` GitHub secrets.
- Confirm the deploy workflow slug matches the approved plugin slug.
- Run a dry-run deployment from GitHub Actions before the first real post-approval release.
- Create the release from `main` only after the QA matrix and packaging checks pass.
