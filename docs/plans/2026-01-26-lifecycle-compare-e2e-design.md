# Lifecycle Compare E2E Design

## Summary

Add end-to-end tests that compare native mini-program lifecycle behavior against WeVu implementations. The tests cover App, Page, and Component lifecycles/events, with native as the baseline. We will run weapp runtime verification now, leaving room for full multi-platform runtime verification later.

## Goals

- Provide a strict one-to-one lifecycle comparison for App/Page/Component.
- Include on-demand Page events (share, scroll, reach bottom, etc.).
- Record hook order, counts, and data snapshots for native vs WeVu.
- Keep the test harness deterministic and readable.

## Non-goals

- Full cross-platform runtime verification in this iteration.
- Testing non-weapp platform-specific lifecycles.

## App Structure

Create three e2e apps under `e2e-apps/`:

- `lifecycle-compare`: one app containing native and WeVu pages and components for direct comparison.
- `app-lifecycle-native`: native App lifecycle baseline.
- `app-lifecycle-wevu`: WeVu App lifecycle tests (both `app.ts` and `app.vue` via `mode`-based `srcRoot`).

Each app includes `weapp-vite.config.ts` (`weapp.srcRoot: 'src'`), `project.config.json`, `mini.project.json`, and `project.swan.json`.

## Logging Model

All hooks call a shared recorder that writes structured entries to `data` (or `globalData` for App):

- `source`, `hook`, `order`, `args`, `snapshot`, `skipped`.
  Snapshots exclude log fields and focus on a stable lifecycle state map. `finalizeLifecycleLogs()` inserts skipped entries for hooks that could not be triggered in automation.

## Lifecycle Coverage

- App: `onLaunch/onShow/onHide/onError/onPageNotFound/onUnhandledRejection/onThemeChange`.
- Page: `onLoad/onShow/onReady/onHide/onUnload/onRouteDone/onPullDownRefresh/onReachBottom/onPageScroll/onResize/onTabItemTap/onShareAppMessage/onShareTimeline/onAddToFavorites/onSaveExitState`.
- Component: `created/attached/ready/moved/detached/error` and `pageLifetimes.show/hide/resize`.

Events are triggered via `miniprogram-automator` where possible (navigation, scroll, tab switches). Untriggerable hooks are marked `skipped` to keep the comparison explicit.

## Tests

Add new e2e tests to:

- Build each app, launch with automator, trigger events, call `finalizeLifecycleLogs()`, and compare logs.
- Compare WeVu TS and WeVu SFC outputs against native baselines.

## Open Items

- Some hooks (share/favorites/resize/moved/error) may be skipped if automation cannot trigger them reliably.
