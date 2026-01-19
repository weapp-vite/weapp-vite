# Web Navbar Parity Design

## Goals

- Achieve near 1:1 WeChat Mini Program navbar rendering on mobile web.
- Support both JSON config (`app.json`/`page.json`) and `<page-meta><navigation-bar /></page-meta>` usage.
- Match key behaviors: safe area handling, title/foreground/background updates, and loading indicator.
- Respect `navigationStyle: "custom"` by not rendering a default navbar.

## Non-goals

- Desktop web parity.
- Full re-skinning of all built-in components (only navbar in this scope).

## Recommended Approach (B: Build-time injection)

Transform page templates at build time to inject a standardized `weapp-navigation-bar` element at the top. Keep runtime responsibilities limited to layout calculations and API-driven updates.

## Build-time Transformation

- Parse `app.json` + `page.json` to collect `navigationBarTitleText`, `navigationBarBackgroundColor`, `navigationBarTextStyle`, `navigationStyle`.
- If `<page-meta><navigation-bar /></page-meta>` exists, treat it as the highest priority override.
- Emit a single `<weapp-navigation-bar>` with normalized props.
- If `navigationStyle: "custom"`, do not inject.

## Runtime Responsibilities

- Compute safe area and status bar height using `env(safe-area-inset-*)` + `visualViewport`.
- Allow user overrides for embedded WebView scenarios (priority: user config > runtime calc > fallback).
- Update navbar state from `wx.*` APIs without DOM mutation by consumers.

## Component and Style

- `weapp-navigation-bar` renders: status bar spacer + content area (left, title, right).
- CSS variables: `--weapp-status-bar-height`, `--weapp-nav-content-height`, `--weapp-nav-bg`, `--weapp-nav-color`.
- Default typography aligned to Mini Program: 17px title, centered.
- Support `loading` state rendering.

## API Mapping

- `wx.setNavigationBarTitle` -> `title`.
- `wx.setNavigationBarColor` -> `backgroundColor` + `frontColor` (from `textStyle`).
- `wx.showNavigationBarLoading` / `wx.hideNavigationBarLoading` -> `loading`.
- `navigationStyle: "custom"` -> navbar not injected; APIs no-op with dev warning.

## Error Handling

- Missing or invalid JSON: inject default navbar with dev warning.
- Invalid `page-meta` layout: dev warning, fallback to JSON.
- Safe area calc unavailable: fallback to platform defaults; allow overrides.

## Testing

- Build-time unit tests: config merge priority, custom navigation, page-meta overrides.
- Runtime unit tests: API updates reflect in DOM, safe area override priority.
- E2E: mobile viewport snapshots for iOS/Android approximations.
