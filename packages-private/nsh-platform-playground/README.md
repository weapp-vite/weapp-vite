# NSH Mini Program Runtime Playground

This private package demonstrates a standalone Vite plugin that publishes the
Mini Program runtime from `sonofmagic/nsh-platform-miniprogram`. It does not
modify `weapp-vite` or `wevu`, and it does not invoke the upstream Rust compiler
or CLI.

## Build

```sh
pnpm --filter @weapp-vite/nsh-platform-playground build
```

Import `packages-private/nsh-platform-playground/dist/` into WeChat DevTools.
The Vite output is the Mini Program project root and includes the app config,
runtime pages/components, and `nsh/app.wasm.br`. `demo.js` is an extra Vite
entry used to exercise normal bundler output; it is not referenced by
`app.json`.

The plugin is available from `src/index.ts`:

```ts
import { nshPlatformRuntime } from './src'

nshPlatformRuntime({
  wasm: 'src/wasm/demo.wasm',
  appName: 'NSH Runtime Demo',
  appid: 'touristappid',
})
```

`wasm` points to an existing `.wasm` module or a Brotli-compressed `.wasm.br`
module. The plugin compresses raw `.wasm` input and copies `.wasm.br` input to
`nsh/app.wasm.br`; it does not compile modules. `appId` and `appid` are aliases.
`outputRoot` optionally
places all generated project files under a relative output subdirectory.

The committed `src/wasm/demo.wasm` is a tiny hand-authored ABI fixture. Its
readable WAT source is `src/wasm/demo.wat`. It sends a text node, a tappable
view, and canvas drawing operations through the runtime's `nsh_mp.submit`
import, then changes all three after a tap. It validates the JS runtime's
contract; it is not output from the NSH Rust compiler and does not represent a
real NSH application.

## Scope

The runtime boots `WXWebAssembly`, applies tree updates to the page, renders
canvas operations, and forwards touch/input/scroll events. The upstream
project currently targets WeChat Mini Programs. Check
[`UPSTREAM.md`](./UPSTREAM.md) for the exact source revision and license.

```sh
pnpm --filter @weapp-vite/nsh-platform-playground typecheck
pnpm --filter @weapp-vite/nsh-platform-playground test
pnpm --filter @weapp-vite/nsh-platform-playground build
```
