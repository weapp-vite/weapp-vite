# `rolldown-plugin-dts` Bug Report Draft

## Summary

在当前仓库里，`packages/web` 使用 `tsdown` 直接生成 declaration files 时，`rolldown-plugin-dts` 会在 TypeScript 内部崩溃，报错：

```text
Error: Debug Failure. False expression: Lexical environment is suspended.
```

这个问题出现在 declaration 生成阶段，不是 JavaScript bundling 阶段。

## Environment

- Repo: `weapp-vite`
- Package: `packages/web`
- Node: `v22.22.0`
- TypeScript: `5.9.3`
- tsdown: `0.21.3`
- rolldown: `1.0.0-rc.9`
- rolldown-plugin-dts: `0.22.5`

## Reproduction

### Package context

The package has multiple entries:

- `src/index.ts`
- `src/plugin.ts`
- `src/runtime/index.ts`

It can build JS successfully with `tsdown`.

### Repro command

From repo root:

```bash
pnpm --filter @weapp-vite/web exec tsdown --dts --tsconfig tsconfig.build.json
```

Equivalent package config shape:

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'runtime/index': './src/runtime/index.ts',
    'plugin': './src/plugin.ts',
  },
  dts: true,
  tsconfig: './tsconfig.build.json',
  format: ['esm'],
  target: 'node20',
})
```

And the build tsconfig is restricted to `src` only:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "emitDeclarationOnly": true,
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["test", "dist", "node_modules"]
}
```

## Actual Result

`rolldown-plugin-dts` crashes with:

```text
[plugin rolldown-plugin-dts:generate]
Error: Debug Failure. False expression: Lexical environment is suspended.
    at Object.startLexicalEnvironment (.../typescript/lib/typescript.js:120390:11)
    at visitParameterList (.../typescript/lib/typescript.js:95179:11)
    at visitEachChildOfGetAccessorDeclaration (.../typescript/lib/typescript.js:95433:7)
    at Object.visitEachChild (.../typescript/lib/typescript.js:95332:33)
    at visitor (.../rolldown-plugin-dts/dist/tsc-*.mjs:72:13)
    at visitArrayWorker (.../typescript/lib/typescript.js:95146:49)
    at visitNodes2 (.../typescript/lib/typescript.js:95117:19)
    at visitEachChildOfTypeLiteralNode (.../typescript/lib/typescript.js:95522:7)
    at Object.visitEachChild (.../typescript/lib/typescript.js:95332:33)
    at visitor (.../rolldown-plugin-dts/dist/tsc-*.mjs:72:13)
```

## Notes About Trigger Conditions

从栈来看，崩溃点稳定落在：

- `visitEachChildOfGetAccessorDeclaration`
- `visitParameterList`
- `visitEachChildOfTypeLiteralNode`

这说明问题很可能与 getter/accessor 相关的 `.d.ts` AST 遍历有关。

仓库中 `packages/web/src` 内确实存在这类代码，例如：

- `packages/web/src/runtime/component/element.ts`
- `packages/web/src/runtime/navigationBar/index.ts`
- `packages/web/src/runtime/button/index.ts`

我已经尝试过把最明显的 `static get observedAttributes()` 改成静态属性形式，并给若干顶层函数补显式返回类型，但仍然可以复现该崩溃。

## Additional Experiments

### 1. JS bundling alone works

This succeeds:

```bash
pnpm --filter @weapp-vite/web exec tsdown --no-dts
```

So the issue is isolated to declaration generation.

### 2. `tsc --emitDeclarationOnly` works

This succeeds:

```bash
pnpm --filter @weapp-vite/web exec tsc -p tsconfig.build.json
```

So the source package itself is capable of generating declarations via plain TypeScript.

### 3. Oxc / isolated declarations path changes the failure mode

Using:

```ts
const dts = { oxc: true }
```

does not hit the same TS internal crash, but then fails with many `TS9007` diagnostics requiring explicit return type annotations under isolated declarations.

That suggests:

- the default declaration generation path crashes internally
- the isolated declarations path survives longer, but imposes stricter source requirements

## Expected Result

One of the following:

1. `rolldown-plugin-dts` should not crash internally on this source graph and instead either generate declarations successfully, or
2. it should report a stable user-facing diagnostic that points to the actual unsupported source shape.

## Why This Matters

当前这会阻止 `packages/web` 迁移到“完全由 `tsdown` 负责 JS + dts”的单一构建链路。

目前只能退回到：

- `tsdown --no-dts` for JS
- `tsc -p tsconfig.build.json` for declarations

which works, but defeats the goal of using a single `tsdown` build for publish artifacts.
