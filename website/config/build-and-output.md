---
title: 构建输出与兼容
description: 解释 weapp-vite 的平台、输出目录、JS 输出格式与兼容策略，以及这些配置与 Vite build 的边界。
keywords:
  - 配置
  - config
  - build
  - output
  - 构建输出与兼容
  - jsFormat
  - multiPlatform
---

# 构建输出与兼容 {#build-and-output}

这一页回答两个问题：

1. `weapp-vite` 最终把小程序产物输出到哪里
2. 这些产物按哪个平台、哪种 JS 格式和怎样的兼容策略输出

它覆盖的是 **小程序语义层** 的配置；如果你在找 `build.minify`、`build.sourcemap`、`build.rollupOptions` 这类 **Vite 原生 build 配置**，请结合阅读：

- [Vite 中文官方配置文档 · build](https://cn.vite.dev/config/build-options)

[[toc]]

## 输出目录是怎么决定的

默认情况下，`weapp-vite` 会优先从当前平台对应的 `project.config.*` 中读取：

- `miniprogramRoot`
- `pluginRoot`

如果顶层 Vite `build.outDir` 没有显式指定：

- 小程序主应用默认输出到 `miniprogramRoot`
- 插件输出目录会结合 `pluginRoot` 与构建上下文推导

如果你显式配置了顶层 `build.outDir`，则以你的 Vite 配置为准。

> [!NOTE]
> 当启用 `weapp.multiPlatform`，且多个平台共用相对 `miniprogramRoot` 时，建议明确检查最终产物目录，避免不同平台互相覆盖。

## `weapp.platform` {#weapp-platform}

- **类型**：`'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'`
- **默认值**：`'weapp'`

作用：

- 决定当前构建按哪个小程序平台解析扩展名和 project config
- 影响平台分支逻辑、模板兼容策略、部分 JSON / npm 输出行为

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'alipay',
  },
})
```

适用建议：

- 单平台项目：直接写死即可
- 多平台项目：通常配合 CLI 的 `--platform` 与 `weapp.multiPlatform` 使用

## `weapp.multiPlatform` {#weapp-multiplatform}

- **类型**：`boolean | { enabled?: boolean; projectConfigRoot?: string }`
- **默认值**：`false`

用于同仓库维护多套平台 `project.config.*`。

```ts
export default defineConfig({
  weapp: {
    multiPlatform: {
      enabled: true,
      projectConfigRoot: 'config',
    },
  },
})
```

行为说明：

- `true` 等价于 `{ enabled: true, projectConfigRoot: 'config' }`
- 启用后会按平台读取 `${projectConfigRoot}/${platform}/...` 下的项目配置文件
- 一般要配合命令行 `--platform` 使用，例如 `weapp-vite build --platform alipay`

适用场景：

- 同一业务同时维护微信、支付宝、抖音小程序
- 平台间 `appid`、编译选项、输出目录策略不同

## `weapp.cleanOutputsInDev` {#weapp-cleanoutputsindev}

- **类型**：`boolean`
- **默认值**：`true`

控制开发态启动前是否清空输出目录。

```ts
export default defineConfig({
  weapp: {
    cleanOutputsInDev: false,
  },
})
```

说明：

- `dev` 模式默认会先清空输出目录，避免旧产物干扰
- `build` 模式始终清空输出目录，不受此字段影响
- 大项目若频繁冷启动，可按需关闭开发态清理换取速度

## `weapp.packageSizeWarningBytes` {#weapp-packagesizewarningbytes}

- **类型**：`number`
- **默认值**：`2097152`

用于主包/分包体积告警阈值，单位是字节。

```ts
export default defineConfig({
  weapp: {
    packageSizeWarningBytes: 1.5 * 1024 * 1024,
  },
})
```

适合：

- 团队想在逼近平台限制前更早收到提醒
- 有明确包体预算，需要设置更保守的阈值

## `weapp.jsFormat` {#weapp-jsformat}

- **类型**：`'cjs' | 'esm'`
- **默认值**：`'cjs'`

决定脚本产物使用 CommonJS 还是 ESM。

```ts
export default defineConfig({
  weapp: {
    jsFormat: 'esm',
  },
})
```

选择建议：

- `cjs`：兼容性最好，默认推荐
- `esm`：适合明确采用 ESM 输出策略的项目，但要结合目标平台验证

> [!WARNING]
> 若你选择 `esm`，应同时检查目标开发者工具与平台对该输出形式的支持，不要只在 Web 或单机环境里验证。

## `weapp.es5` {#weapp-es5}

- **类型**：`boolean`
- **状态**：已废弃

历史上它会借助 `@swc/core` 做额外 ES5 降级。当前不建议继续依赖。

迁移建议：

- 保持顶层 `build.target >= 'es2020'`
- 在微信开发者工具中开启“将 JS 编译成 ES5”
- 把兼容压力尽量交给平台工具链，而不是继续依赖已废弃链路

## 顶层 `build.*` 该怎么配

这些字段仍然按 Vite 标准语义工作：

- `build.outDir`
- `build.target`
- `build.minify`
- `build.sourcemap`
- `build.rolldownOptions`

例如：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: {
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
  weapp: {
    jsFormat: 'cjs',
  },
})
```

建议这样理解边界：

- `weapp.platform` / `weapp.jsFormat` / `weapp.multiPlatform` 决定“小程序产物应该长什么样”
- 顶层 `build.*` 决定“Vite / Rolldown 用什么方式构建这些产物”

更多字段说明请直接看：

- [Vite 中文官方配置文档 · build](https://cn.vite.dev/config/build-options)

## 常见组合

### 多平台项目

```ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
  weapp: {
    platform: 'weapp',
    multiPlatform: true,
  },
})
```

适合把“具体平台”交给 CLI 参数，而不是写死在单个配置文件里。

### 保守兼容输出

```ts
export default defineConfig({
  build: {
    target: 'es2020',
  },
  weapp: {
    jsFormat: 'cjs',
  },
})
```

这是绝大多数业务项目更稳的起点。

### 调试优先输出

```ts
export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
  },
  weapp: {
    cleanOutputsInDev: false,
  },
})
```

适合当前重点在定位运行时和产物问题，而不是压缩包体。

---

如果你接下来要处理源码入口、插件目录、资源复制，请继续看 [基础目录与资源收集](./paths.md)。如果你要处理分包和共享模块，再看 [分包配置](./subpackages.md) 与 [共享 Chunk 配置](./chunks.md)。
