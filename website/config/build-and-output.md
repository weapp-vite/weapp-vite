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

使用 `weapp.multiPlatform.projectConfigs` 时，无需原生输入 JSON；默认代码目录是 `dist/<平台>/dist/`，生成的项目 JSON 与 `app.json` 同级。显式 `build.outDir` 可改变这个目录。

未提供 `projectConfigs` 时保留原生文件方式：`weapp-vite` 从当前平台对应的项目配置中读取：

- `miniprogramRoot`
- `pluginRoot`

如果顶层 Vite `build.outDir` 没有显式指定：

- 小程序主应用默认输出到 `miniprogramRoot`
- 插件输出目录会结合 `pluginRoot` 与构建上下文推导

如果你显式配置了顶层 `build.outDir`，则以你的 Vite 配置为准。

> [!NOTE]
> 原生文件方式启用 `weapp.multiPlatform` 后，若多个平台共用相对 `miniprogramRoot`，建议明确检查最终产物目录，避免不同平台互相覆盖。

## `weapp.upload` {#weapp-upload}

- **类型**：`{ version?: string; desc?: string }`
- **默认值**：未配置

为显式执行的 `wv build --upload` 或独立 `wv upload` 提供默认版本与说明。CLI 的 `--uv` / `--desc` 优先；版本未配置时读取 `package.json.version`，说明未配置时使用项目名称与最终版本。配置只支持 `version`、`desc`，不支持凭据字段。

这不是自动上传开关：普通 `build`、`dev/HMR` 不使用这组上传默认参数，也不上传；`preview` 不使用该配置。配置文件本身仍会正常加载与合并，不保证其中的 JavaScript getter 延迟求值。`build --upload` 复用本次构建，等待所有选中的构建后端成功并校验小程序产物后才调用官方工具；独立 `upload` 自行构建后上传。

```bash
wv build --upload --dry-run
wv build --upload -p weapp --uv 1.2.3 --desc "更新首页"
```

`build` 的 `--uv`、`--desc`、`--dry-run` 必须与 `--upload` 一起使用；`--watch --upload`、`-p web --upload` 会报错。`build -p all --upload` 仍是“小程序 + Web”，两者构建都成功后只上传小程序；独立 `wv upload -p all` 才表示六端逐一构建上传。`--dry-run` 不校验凭据、不调用 SDK。

AppID 来自目标项目配置，凭据只通过环境变量提供。各平台完整配置、上传与预览、环境文件、密钥获取、批量操作及 CI 见[小程序上传与预览指南](../guide/upload.md)；完整触发矩阵见[上传配置与触发时机](../guide/cli.md#上传配置与触发时机)。淘宝目前不在统一上传支持列表内。

## `weapp.platform` {#weapp-platform}

- **类型**：`'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'`
- **默认值**：`'weapp'`

作用：

- 决定当前构建按哪个小程序平台解析扩展名和 project config
- 影响平台分支逻辑、模板兼容策略、部分 JSON / npm 输出行为
- 决定原生模板和样式 sidecar 的选择顺序；目标平台原生后缀优先，便携后缀作为回退

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

支付宝平台可以直接接收原生 `.axml` / `.acss` 源码。若同一入口同时存在多种 sidecar，`platform: 'alipay'` 的模板选择顺序为 `.axml`、`.wxml`、`.html`，样式选择顺序为 `.acss`、`.wxss`、`.css` 和预处理器；页面、组件、分包、自动路由、watcher 与原生 layout 共用这套规则。原生 `.axml` 保留支付宝宿主语法，便携 `.wxml` 和 Vue SFC 则继续转换为支付宝产物。

抖音平台同样可以直接接收原生 `.ttml` / `.ttss` 源码。`platform: 'tt'` 的模板选择顺序为 `.ttml`、`.wxml`、`.html`，样式选择顺序为 `.ttss`、`.wxss`、`.css` 和预处理器。原生 `.ttml` 保留 `tt:*`、`bind:tap` / `catch:tap`、WXS 和原生组件语法；便携 `.wxml` 与 Vue SFC 继续转换为 TTML。该规则同时作用于页面、组件、分包、自动路由、watcher、layout 和 npm 原生组件落位。

## `weapp.multiPlatform` {#weapp-multiplatform}

- **类型**：`boolean | MultiPlatformConfig`
- **默认值**：`false`

同一业务构建多个平台时，推荐在一份配置中使用 `projectConfigs`，由打包器生成原生项目 JSON：

```ts
import { defineConfig } from 'weapp-vite/config'

const common = { projectname: 'my-app' }

export default defineConfig({
  weapp: {
    multiPlatform: {
      projectConfigs: {
        weapp: { ...common, appid: 'replace-with-weapp-app-id' },
        alipay: { ...common, appid: 'replace-with-alipay-app-id' },
      },
    },
  },
})
```

| 字段 | 类型 / 说明 |
| --- | --- |
| `enabled` | 对象形式默认启用；不能同时设为 `false` 并提供 `projectConfigs` |
| `projectConfigs` | 按 `weapp` / `alipay` / `tt` / `xhs` / `jd` / `swan` 配置原生项目字段；公共字段用普通对象展开 |
| `targets` | `'all'` 或平台数组；省略时从 `projectConfigs` 的键推导，文件模式则默认六端 |
| `projectConfigRoot` | 原生文件模式的配置目录，默认 `'config'`；不能与 `projectConfigs` 同时提供 |

- `projectConfigs` 不读取原生项目文件或私有 JSON；缺少选中平台时报错，不回退到文件。
- 标准项目 JSON 由打包器生成在代码输出目录内，默认 `dist/<平台>/dist/`，与 `app.json` 同级。SDK 代码根为 `.`，默认 `compileType` 为 `miniprogram`。
- `miniprogramRoot`、`srcMiniprogramRoot`、`smartProgramRoot` 由构建管理，不能出现在输入对象中；修改目录使用 `build.outDir`，不能手工修补生成 JSON。
- 对象展开不做隐式深合并；Token、私钥等凭据不能写入 `projectConfigs`。
- 统一项目配置用于完整小程序，独立插件仍使用原生文件方式；Web/组件库构建不生成小程序项目 JSON。
- 已有文件模式保持兼容：`true` 等价于 `{ enabled: true, projectConfigRoot: 'config' }`，从 `${projectConfigRoot}/${platform}/` 读取原生配置。
- 命令仍显式选择目标，例如 `wv build --platform alipay`；`upload -p all` 表示六端，不会缩减为已配置的平台子集。

六端完整示例见[批量上传](../guide/upload.md#batch)，不同 AppID 与 test/production 见[环境配置](../guide/upload/environments.md#appid)。

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
- `build` 模式默认清空输出目录，不受此字段影响
- 显式设置 `build.emptyOutDir: false` 时，开发和生产均跳过全量清理，主包、独立插件输出和完整重建遵循同一约束；旧文件也会保留，删除源码后需自行清理不再需要的产物
- 大项目若频繁冷启动，可按需关闭开发态清理换取速度

## `weapp.buildScope` {#weapp-buildscope}

- **类型**：`string | string[] | { includeMainPackage?: boolean; include?: string[] }`
- **默认值**：不启用，完整构建

用于只构建主包和指定分包。它适合中大型小程序按业务分包日常开发、局部验证或临时分析，不建议直接替代发布前的完整构建。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    buildScope: {
      includeMainPackage: true,
      include: ['packages/order', 'packages/user'],
    },
  },
})
```

等价的 CLI 写法：

```bash
wv dev --scope main,packages/order,packages/user
wv build --scope packages/order
```

语义说明：

- `main` 表示主包。
- `packages/order` 这类值匹配 `app.json.subPackages[].root` / `subpackages[].root`。
- CLI `--scope` 优先级高于配置文件里的 `weapp.buildScope`。
- 字符串写法会按逗号分隔，例如 `'main,packages/order'`。
- 数组写法适合在配置里复用，例如 `['main', 'packages/order']`。
- `includeMainPackage` 默认是 `true`，所以 `wv build --scope packages/order` 会构建主包和 `packages/order` 分包。
- 如果确实要排除主包，可以使用对象写法并设置 `includeMainPackage: false`。

构建效果：

- 产物 `app.json.pages` 只在包含主包时保留。
- 产物 `app.json.subPackages` 只保留参与 scope 的分包。
- `preloadRule` 只保留参与 scope 的触发页，并按分包 `root` / `name` 过滤 `packages`；`__APP__` 仅在主包参与构建时保留。
- `tabBar.list` 只保留仍在本次主包中的页面；过滤后少于微信要求的 2 项时会删除整个 `tabBar`。
- `entryPagePath` 指向被排除的主包页面时会删除，由本次主包 `pages` 的第一项接管默认启动页。
- 开启 `weapp.autoRoutes` 时，`weapp-vite/auto-routes` 导出的 `pages`、`subPackages`、typed router 也会基于 scope 后的结果生成。
- 开发态 watcher 会收窄到主包 `pages/**` 与参与 scope 的分包 root。

> [!NOTE]
> `buildScope` 是入口级裁剪，不是构建完成后删除文件。未参与 scope 的分包不会进入本次 app 注册图，因此微信开发者工具读取到的 `app.json` 也只包含本次参与构建的分包。

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
