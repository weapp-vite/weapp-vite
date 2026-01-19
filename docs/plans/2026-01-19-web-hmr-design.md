# Web HMR (weapp-vite web runtime)

## Goals

- Web dev uses Vite HMR for partial updates (template/style/logic) without full refresh.
- Preserve page/component instance and `data` on updates.
- Keep mini-program hot update behavior unchanged.
- App updates replace methods/lifecycles without re-running `onLaunch` or clearing `globalData`.

## Scope

- Affects `@weapp-vite/web` runtime and web plugin only.
- No changes to miniprogram build pipeline.

## Architecture

- Web plugin injects `import.meta.hot.accept()` into page/component/app script modules so Vite HMR re-runs the module without full reload.
- Runtime supports "update mode" in `registerPage/registerComponent/registerApp` when the same id registers again.
- Component class keeps dynamic references for template/style/methods/lifetimes and exposes `__weappUpdate` to refresh existing instances.

## Update Flow

### Template

- On re-register: replace template renderer, call `requestUpdate()` on existing instances.
- Re-render uses latest template while keeping existing `data`.

### Style

- Use deterministic style id per component/page tag (e.g. `weapp-web-style:${tag}`).
- On re-register: replace CSS contents via `injectStyle` for the same id; no duplicate style tags.

### Methods & Lifetimes

- Store latest methods/lifetimes in component class (or record) and resolve handlers at event time.
- Do not re-run page lifecycles (`onLoad/onShow/onReady`) on update.
- App updates only replace hook references and do not re-run `onLaunch` or clear `globalData`.

## Error Handling

- If new template/methods fail or are invalid, keep old ones and log a warning.
- Style update failure keeps previous style to avoid flicker.

## Testing

- Unit tests for re-register update path: data preserved, new handlers invoked, lifecycle not re-fired.
- Plugin tests ensure HMR accept injection for web modules.
- Manual: edit `*.wxml/*.wxss/*.ts` in `apps/weapp-vite-web-demo`; confirm no full refresh, state preserved.

## Out of Scope

- SSR or production HMR behavior.
- Mini-program runtime changes.
