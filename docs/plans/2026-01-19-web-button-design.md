# Web Button Parity Design

## Goals

- Match WeChat Mini Program button styles/behaviors on mobile web (devtools iPhone preset).
- Replace `button` with a web-specific component at build time for consistent behavior.
- Support `type/plain/size/loading/disabled/hover-*` and `form-type`.
- Allow user `class/style` to apply on the host element.

## Non-goals

- Implement `open-type` behaviors (only style placeholders).
- Desktop web parity.

## Approach

- Compile-time replace `button` with `weapp-button` in WXML rendering.
- Runtime defines `weapp-button` custom element without Shadow DOM.
- Inject default button styles via runtime `injectStyle`.
- Extend runtime form handling to emit `submit/reset` with `detail.value`.
- Add build-time config to control default `preventDefault` for form submits.

## Component Structure

- Host: `<weapp-button>` receives user `class/style`.
- Internal: `<button class="weapp-btn">`
  - `<span class="weapp-btn__content">`
    - `<span class="weapp-btn__loading"></span>`
    - `<span class="weapp-btn__text"><slot /></span>`
- Classes by state: `weapp-btn--primary/warn/default`, `--plain`, `--mini`, `--disabled`, `--loading`, `--hover`, `--open-type-*`.

## Behavior

- `disabled/loading`: disable clicks and stop event propagation.
- `hover-class/hover-start-time/hover-stay-time`: apply/remove hover class with timers; `hover-class="none"` disables.
- `form-type="submit|reset"`: find closest `form`, dispatch events.
  - `submit`: construct `detail.value` by collecting named controls.
  - `reset`: reset form and dispatch `reset`.
- `open-type`: add classes only; no behavior.

## Form Value Collection

- Support `input/textarea/checkbox/radio/switch/picker/slider`.
- Skip controls without `name`.
- `checkbox`: array of checked values.
- `radio`: single value.
- `switch`: boolean or `value` if provided.
- Respect `disabled` controls.

## Config

- Build-time option to set default `preventDefault` on form submit.
- Inject into runtime via `initializePageRoutes` options.

## Testing

- Compile: ensure `button` becomes `weapp-button` and attributes preserved.
- Runtime: hover timing, disabled/loading blocking, `submit/reset` detail value.
- E2E snapshots for `primary/warn/default/plain/mini/loading/disabled`.
