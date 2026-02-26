---
title: API 与选项说明
description: rolldown-require 暴露了 bundleRequire / bundleFile /
  loadFromBundledFile 三个 API，但推荐优先使用一站式的 bundleRequire。它会完成入口解析、rolldow…
keywords:
  - 配置
  - api
  - packages
  - rolldown
  - require
  - 与选项说明
  - rolldown-require
  - 暴露了
---

# API 与选项说明

> 语言： [English](/packages/rolldown-require/options) | 中文

`rolldown-require` 暴露了 `bundleRequire` / `bundleFile` / `loadFromBundledFile` 三个 API，但推荐优先使用一站式的 `bundleRequire`。它会完成入口解析、rolldown 打包、临时产物生成与最终加载，并返回：

- `mod`: 已执行的模块（若存在 `default`，会自动返回 `default`）
- `dependencies`: 打包阶段命中的文件路径列表

## 常用选项

### filepath / cwd

- `filepath` 必填，支持相对路径或绝对路径。
- `cwd` 默认使用 `process.cwd()`，用于解析相对入口和 `tsconfig`。

### format

- 不传则自动根据后缀与 `package.json.type` 推断（`.mjs`/`.mts`/`type:module` -> `esm`，`.cjs`/`.cts` -> `cjs`）。
- 手动传入 `cjs`/`esm` 可跳过推断，例如希望强制以 ESM 方式加载 `.js`。

### require

自定义产物的加载方式，签名为 `(outfile, { format }) => any`。默认行为：

- ESM：`import(outfile)`（在打包时会写入临时文件或 data: URL）
- CJS：通过 `_require.extensions` 临时钩子编译并 `require` 源文件

典型用途：接入你自己的 loader、为 ESM 产物追加自定义 `import` 逻辑，或在测试环境中注入 mock。

### rolldownOptions

允许透传部分 rolldown 选项：

- `input`: 可加入自定义插件、`resolve` 规则、`transform` 等。内部会固定 `platform: 'node'`、`treeshake: false`，并注入 `define` 保持 `__dirname`/`__filename`/`import.meta.url`。
- `output`: 会与内部默认项合并，但 `format` 会被 `format` 选项覆盖，`inlineDynamicImports` 固定为 `true`。

> 避免覆写 `platform`、`input` 或 `inlineDynamicImports`，否则可能导致运行时与依赖收集异常。

### external

传递给 rolldown 的 `external` 配置。插件会自动外部化大部分 `node_modules` 依赖并保留 JSON 内联；通过该选项可进一步排除或强制内联特定依赖。

### tsconfig

- 默认自动向上查找 `tsconfig.json` 并读取 `paths`，让打包阶段能解析别名。
- 传入字符串可指定路径；传入 `false` 可禁用 `tsconfig` 解析。

### getOutputFile

自定义临时产物的落盘路径（默认生成到 `node_modules/.rolldown-require` 或系统临时目录，并带随机后缀）。可用于将产物写入更易调试的位置。

### preserveTemporaryFile

默认会在 CJS 加载完成或 ESM 加载后清理临时文件。将其设为 `true`（或设置环境变量 `BUNDLE_REQUIRE_PRESERVE`）可保留产物，便于问题排查。

### cache

`false`/未设置时关闭缓存。传入 `true` 或配置对象可以打开持久化 + 内存缓存，详见 [加载流程与缓存策略](/packages/rolldown-require/cache.zh)。

## 组合示例

```ts
import { bundleRequire } from 'rolldown-require'

const { mod } = await bundleRequire({
  cwd: process.cwd(),
  filepath: './tooling/config.ts',
  format: 'esm',
  tsconfig: './tsconfig.node.json',
  external: ['fsevents'],
  cache: {
    enabled: true,
    dir: './node_modules/.rolldown-require-cache',
    onEvent: e => console.log('[rolldown-require cache]', e),
  },
  rolldownOptions: {
    input: {
      plugins: [
        myCustomPlugin(),
      ],
    },
  },
})
```

上述配置会：

1. 强制以 ESM 格式打包 `tooling/config.ts` 并使用指定的 `tsconfig` 解析路径。
2. 将 `fsevents` 标记为外部依赖，其余依赖遵循默认外部化策略。
3. 把临时产物缓存到指定目录，并通过 `onEvent` 输出命中/失效信息。
