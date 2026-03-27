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
- 当前按哪个小程序平台解析 `project.config.*`
- 是否输出 CommonJS 或 ESM
- 是否启用 ES5 兼容降级
- 是否启用多平台 `project.config` 解析
- 开发态是否清空输出目录
- 何时给包体积发出告警
- 是否压缩代码、是否生成 sourcemap

[[toc]]

## 输出目录来源

`weapp-vite` 的输出目录默认由 `project.config.json`（或多端配置）中的 **miniprogramRoot** 决定：

- 若 `build.outDir` **未显式配置**，`weapp-vite` 会将 `build.outDir` 设置为 `miniprogramRoot`。
- 若 `build.outDir` **已配置**，则以你的配置为准。

> [!NOTE]
> 当启用 `weapp.multiPlatform` 且 `miniprogramRoot` 为相对路径 `dist` 时，输出会自动调整为 `dist/<platform>/dist`，以避免不同平台互相覆盖。

## `weapp.platform` {#weapp-platform}
- **类型**：`'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'`
- **默认值**：`'weapp'`
- **作用**：指定当前构建按哪个小程序平台解析输出扩展名、`project.config` 文件名、平台差异逻辑与部分模板/JSON 兼容行为。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'alipay',
  },
})
```

行为说明：
- 不配时默认按微信小程序处理。
- 在单平台项目里，直接写死 `weapp.platform` 即可。
- 在多平台项目里，通常配合 CLI `--platform` 与 `weapp.multiPlatform` 一起使用。
- 不同平台会影响输出扩展名与项目配置文件名，例如微信默认读取 `project.config.json`，支付宝读取 `mini.project.json`。

## `weapp.multiPlatform` {#weapp-multiplatform}
- **类型**：`boolean | { enabled?: boolean; projectConfigRoot?: string }`
- **默认值**：`false`
- **作用**：启用按平台读取 `project.config` 的模式，常用于同一仓库输出微信、支付宝、抖音等不同小程序平台。

```ts
import { defineConfig } from 'weapp-vite/config'

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
- `true` 等价于 `{ enabled: true, projectConfigRoot: 'config' }`。
- 启用后会按 `${projectConfigRoot}/${platform}/<platform-config-file>` 解析平台配置。
- 需要配合 CLI `--platform` 指定目标平台，例如 `weapp-vite build --platform alipay`；未显式传入时，仍会回退到 `weapp.platform`。
- 若你的多端项目都使用相对 `miniprogramRoot`，建议显式检查最终输出目录，避免多个平台互相覆盖。

## `weapp.cleanOutputsInDev` {#weapp-cleanoutputsindev}
- **类型**：`boolean`
- **默认值**：`true`
- **作用**：控制开发态启动构建前是否清空输出目录。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    cleanOutputsInDev: false,
  },
})
```

行为说明：
- `dev` 模式默认会先清空输出目录，避免旧产物残留干扰调试。
- 设为 `false` 后，可跳过每次启动前的全量清理，适合大项目或你明确知道输出残留不会造成误判的场景。
- `build` 生产构建仍然会清空输出目录，不受此项影响。

## `weapp.packageSizeWarningBytes` {#weapp-packagesizewarningbytes}
- **类型**：`number`
- **默认值**：`2097152`（`2 * 1024 * 1024`）
- **作用**：控制主包/分包包体积告警阈值，超过时在构建日志中给出提示。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    packageSizeWarningBytes: 1.5 * 1024 * 1024,
  },
})
```

适用场景：
- 团队希望更早发现主包逼近平台体积限制。
- 项目有严格包体预算，需要把告警阈值调得比平台硬限制更保守。

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
> 如果你手动把 `build.target` 设为 **ES2015 以下**，会直接报错；历史上的 `weapp.es5` 兼容方案已废弃，不建议继续依赖。

## `weapp.es5` {#weapp-es5}
- **类型**：`boolean`
- **默认值**：`false`
- **状态**：**已废弃**
- **历史作用**：在输出 CommonJS 的基础上，用 `@swc/core` 进行 **ES5 降级**。

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
- 不建议在新项目中继续开启。
- 仅支持 `jsFormat: 'cjs'`，与 `esm` 同用会直接报错。
- 需要安装 `@swc/core`：`pnpm add -D @swc/core`。
- 开启后，`build.target` 会被强制收敛到 `es2015`，再由 SWC 降级到 ES5。

迁移建议：
- 默认保持 `build.target >= es2020`，让 `?.` / `??` 不再进入 Rolldown 的降级分支。
- 在微信开发者工具中开启「将 JS 编译成 ES5」功能。
- 如果必须兼容极旧环境，再评估是否继续保留 `weapp.es5`。

## `build.minify` 与 `build.sourcemap` {#build-minify-sourcemap}

`weapp-vite` 直接复用 Vite 的 `build` 配置：

- `build.minify`：是否压缩代码（默认生产环境开启）。
- `build.sourcemap`：是否输出 sourcemap（可为 `true | false | 'inline' | 'hidden'`）。

如果你希望 **打包产物不压缩且生成 sourcemap**，可以这样配置：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
  },
})
```

也可以通过 CLI 临时覆盖：

```bash
weapp-vite build --minify false --sourcemap
```

> [!TIP]
> 以上配置作用于你的项目产物（页面/组件/公共 chunk）。  
> 若还需要控制 `miniprogram_npm` 中依赖包的压缩与 sourcemap，请看下方 npm 配置页说明。

---

完成配置后建议重新执行 `pnpm build`，并在开发者工具内验证预览与上传流程。
