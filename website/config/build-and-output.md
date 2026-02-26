---
title: 构建输出与兼容
description: 解释 Weapp-vite 的产物输出目录、JS 输出格式与兼容策略，以及这些配置对包体积和运行稳定性的影响。
keywords:
  - 配置
  - config
  - build
  - output
  - 构建输出与兼容
  - 构建产物
  - 兼容策略
---

# 构建输出与兼容 {#build-and-output}

本页说明 **产物输出目录** 与 **JS 输出格式/兼容策略**。它们直接决定：
- `dist/` 的目录结构
- 是否输出 CommonJS 或 ESM
- 是否启用 ES5 兼容降级

[[toc]]

## 输出目录来源

`weapp-vite` 的输出目录默认由 `project.config.json`（或多端配置）中的 **miniprogramRoot** 决定：

- 若 `build.outDir` **未显式配置**，`weapp-vite` 会将 `build.outDir` 设置为 `miniprogramRoot`。
- 若 `build.outDir` **已配置**，则以你的配置为准。

> [!NOTE]
> 当启用 `weapp.multiPlatform` 且 `miniprogramRoot` 为相对路径 `dist` 时，输出会自动调整为 `dist/<platform>/dist`，以避免不同平台互相覆盖。

## `weapp.jsFormat` {#weapp-jsformat}
- **类型**：`'cjs' | 'esm'`
- **默认值**：`'cjs'`
- **作用**：控制 Rolldown/Rollup 的输出格式。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsFormat: 'esm',
  },
})
```

行为说明：
- `cjs`（默认）：输出 CommonJS，兼容性最好。
- `esm`：输出 ESM；在微信开发者工具中建议开启「ES6 转 ES5」以降低预览差异。

> [!WARNING]
> 如果你手动把 `build.target` 设为 **ES2015 以下**，会直接报错；只有启用 `weapp.es5` 才允许降级到 ES5。

## `weapp.es5` {#weapp-es5}
- **类型**：`boolean`
- **默认值**：`false`
- **作用**：在输出 CommonJS 的基础上，用 `@swc/core` 进行 **ES5 降级**。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsFormat: 'cjs',
    es5: true,
  },
})
```

使用须知：
- 仅支持 `jsFormat: 'cjs'`，与 `esm` 同用会直接报错。
- 需要安装 `@swc/core`：`pnpm add -D @swc/core`。
- 开启后，`build.target` 会被强制收敛到 `es2015`，再由 SWC 降级到 ES5。

---

完成配置后建议重新执行 `pnpm build`，并在开发者工具内验证预览与上传流程。
