# Worker 配置 {#worker-config}

当小程序通过 `app.json` 声明 Worker（`workers` 字段）时，需要确保构建器也同步处理对应脚本。`weapp-vite` 提供了 `weapp.worker` 选项，用于配置 Worker 入口、产物路径以及构建策略。本节介绍如何开启并调优 Worker 支持。

[[toc]]

## `weapp.worker` {#weapp-worker}
- **类型**：
  ```ts
  {
    entry?: string | string[]
  }
  ```
- **默认值**：`undefined`
- **适用场景**：
  - 项目中存在长耗时计算、图像处理、压缩等任务，需要在 Worker 中运行。
  - 希望通过 weapp-vite 将 Worker 源码交给 Vite/Rolldown 编译，复用同样的构建、别名、模块分析逻辑。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    worker: {
      entry: ['src/workers/image.ts', 'src/workers/audio.ts'],
    },
  },
})
```

构建时 weapp-vite 会：

1. 解析 `entry` 列表，生成 Worker 构建上下文。
2. 将编译后的产物输出到与主包一致的 `dist/` 目录，并更新 `workers` 配置引用的路径。
3. 支持 TypeScript/ESM/依赖别名等语法，与主包保持一致的开发体验。

### 常见问题

- **未指定 `entry` 会怎样？** 如果 `weapp.worker` 未配置，weapp-vite 默认不会额外处理 Worker，仍可手动在 `dist` 目录放置脚本，但无法享受自动编译。
- **Worker 能使用 npm 依赖吗？** 可以，weapp-vite 会复用 Vite 库模式处理 npm 包；若 Worker 依赖特定库，请确认在 `dependencies` 中已声明。
- **如何调试 Worker 构建？** 可结合 [`weapp.debug`](/config/shared.md#weapp-debug) 输出 `watchFiles`、`resolveId` 日志，确认 Worker 脚本是否命中构建。

---

若尚未配置分包，推荐先阅读 [分包配置](./subpackages.md) 了解 `weapp.subPackages` 的使用方式，以便在 Worker 与分包同时存在时保持目录结构一致。
