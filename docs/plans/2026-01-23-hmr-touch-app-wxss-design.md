# HMR Touch App WXSS Design

## Overview

Weapp-vite needs a small dev-only behavior to improve WeChat Developer Tools hot reload when weapp-tailwindcss is installed. After each dev rebuild finishes, we will touch the generated `app.wxss` in the mini-program output directory to force a reload. This is opt-in via config but defaults to auto-enable when weapp-tailwindcss is installed.

## Configuration

Add a new config option: `weapp.hmr.touchAppWxss?: boolean | 'auto'`.

- Default: `'auto'`.
- `true`: always touch after dev rebuild end.
- `false`: never touch.
- `'auto'`: enable only when weapp-tailwindcss is detected in the project.

## Detection

Auto mode resolves weapp-tailwindcss via a two-step check:

1. Read `package.json` dependencies/devDependencies for `weapp-tailwindcss`.
2. If not found, attempt `require.resolve('weapp-tailwindcss')` from project root to confirm installation.
   This mirrors the wevu resolver approach and keeps detection robust for pnpm/hoisted setups.

## Trigger & Data Flow

The trigger is bound to dev/serve watch mode only:

- In `buildService.runDev()` when the rollup watcher emits `END` for the `app` target, check the resolved config.
- If enabled, compute the output path as `path.join(configService.outDir, `app.${configService.outputExtensions.wxss}`)` and call the existing `touch()` utility.
- This is limited to the app target and not used for independent subpackage builds or production builds.

## Error Handling & Logging

Touch failures should not break HMR. Errors are swallowed, optionally logged via debug if needed, but no user-facing warnings are required by default.

## Testing

- Add a unit test for default config to ensure `hmr.touchAppWxss` is `'auto'`.
- Add focused tests for detection logic (package.json-only, resolve-only, disabled).
- (Optional) integration test to validate the touch path in dev mode by spying on `touch()`.
