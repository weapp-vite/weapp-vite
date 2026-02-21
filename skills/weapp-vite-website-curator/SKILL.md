---
name: weapp-vite-website-curator
description: Maintain and enrich weapp-vite website docs from packages source of truth. Use when updating `website/` content based on `packages/*` code or README, adding package docs pages, syncing VitePress nav/sidebar, or validating package-to-doc coverage after package changes.
---

# weapp-vite-website-curator

## Overview

Keep `website/` aligned with `packages/*` as the source of truth. Prefer minimal, verifiable edits that improve discoverability and prevent docs drift.

## Workflow

1. Inventory packages

- Read `packages/*/package.json` to identify public package name, description, and exports/bin.
- Read `packages/*/README.md` and only the needed source entry files (for example `src/index.ts`) to verify available APIs.

2. Detect website coverage gaps

- Check `website/packages/` and `website/.vitepress/config.ts` for existing pages and sidebar entries.
- Mark missing pages, stale API examples, and broken navigation links.

3. Update docs pages

- Write or update `website/packages/*.md` pages.
- Keep each page focused on: positioning, when to use, install, minimal usage, and links.
- Prefer statements that can be traced to README or exported APIs.

4. Sync navigation

- Update `packagesSidebarItems` in `website/.vitepress/config.ts`.
- Keep top nav package entry pointing to an overview page (usually `/packages/`).
- Keep bilingual pages grouped when both language versions exist.

5. Verify

- Run `pnpm build` inside `website/` after docs changes.
- Fix unresolved links or route errors before finishing.

## Quality Rules

- Use package code and README as authoritative sources.
- Avoid undocumented claims and speculative roadmap items.
- Keep examples minimal and executable.
- Use Chinese for zh-oriented pages unless the page is explicitly English.
- Prefer adding overview pages before deep pages when scope is broad.

## References

- Use `references/page-template.md` when creating new package pages.
- Use `references/review-checklist.md` before finalizing changes.
