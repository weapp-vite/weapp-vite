<div align="center">
  <a href="https://vite.weapp.dev">
    <img width="200" height="200" hspace="10" src="https://vite.weapp.dev/logo.png" alt="vite logo" />
  </a>
  <h1>Weapp Vite</h1>
  <p>
    给小程序以现代化的开发体验
  </p>
  <img src="https://img.shields.io/node/v/weapp-vite" alt="node-current" />
  <img src="https://img.shields.io/npm/dependency-version/weapp-vite/peer/vite" alt="npm peer dependency version" />
  <img src="https://img.shields.io/github/v/release/weapp-vite/weapp-vite" alt="GitHub release" />
  <img src="https://img.shields.io/npm/l/weapp-vite" alt="licence" />
</div>

<p>&nbsp;</p>

## 普通 Vite 与 Vite+

独立项目继续使用 `wv dev/build`，不需要注册插件或安装 Vite+。采用普通 Vite / Vite+ 时，在顶层 `weapp` 配置旁注册 `weapp-vite/vite` 的 `weapp()`，使用原生 `vite dev/build` / `vp dev/build`。当前插件开放微信 TS/Vue/React 生产构建、原生 `build --watch` 与实验性 classic/stateful 开发；通过 `weapp.hmr.runtime` 选择模式，高级目标仍在分阶段对齐。Vite+ 需要配套 core alias 与依赖覆盖，详见[标准插件指南](https://vite.weapp.dev/guide/vite-plugin.html)。

## 使用文档地址: [vite.weapp.dev](https://vite.weapp.dev)

## Features

- 🚀 **Vue 3 支持**：完整的 Vue 单文件组件（SFC）支持，使用 Vue 官方编译器
  - `<script setup>` 和 TypeScript 完整支持
  - 完整的模板语法（v-if、v-for、v-model 等）
  - Scoped CSS 和 CSS Modules
  - 动态组件、过渡动画、KeepAlive
  - [详细文档 →](./test/vue/README.md)

- ⚡️ **Vite 构建**：带来了 `typescript` / `scss` / `less` 等等的原生支持
- ♻️ **实验性状态保持 HMR**：微信开发者工具中可保留 Page/Component/wevu 状态并替换 JavaScript 方法
- 🔌 **插件生态**：Vite 插件生态支持，也可以自定义编写插件，方便扩展
- 🌐 **实验性 Web Runtime**：同一份原生 WXML/WXSS/TS 或 wevu Vue SFC 源码可通过 `-p web` 启动和构建浏览器版本
- 🎨 **内置 Tailwind CSS**：通过 `weapp.tailwindcss` 配置 `weapp-tailwindcss` 的 core 与 generator 集成；Tailwind CSS v4 项目引入 `tailwindcss` 后可自动启用
- 🧩 **实验性 uni-app 组件库兼容**：通过显式依赖白名单与 `WotUiResolver()` 在微信小程序和 Web 中使用 Wot UI Vue SFC
- 🧰 **IDE 命令增强**：通过 `wv ide <command>` 调用 `weapp-ide-cli`；保留旧顶层上传参数并提示未来弃用，SDK 与 IDE 边界见下文
- 🧪 **真实产物单测**：`weapp-vite/test` 提供不启动 CLI 的程序化测试构建入口，可配合 `@mpcore/test` 测试页面和组件
- 🌍 **内置 i18n**：构建期编译 locale JSON，通过 WXS 翻译模板，并在逻辑层安全切换已构建语言

## 快速开始

微信项目默认会根据微信开发者工具的热重载设置选择 HMR 模式。也可以显式锁定模式：

```ts
export default defineConfig({
  weapp: {
    hmr: {
      runtime: 'stateful-experimental',
    },
  },
})
```

未配置 `weapp.hmr.runtime` 时，`wv dev` 会在启动时读取 `project.private.config.json.setting.compileHotReLoad`：开启时使用 `stateful-experimental`，关闭或无法确认时使用 `classic`。启动日志会以 `HMR 模式` 和 `HMR 切换` 两行显示最终模式、选择来源和切换方法。显式设置 `classic` 或 `stateful-experimental` 会覆盖自动选择，但 Skyline 例外：微信开发者工具暂不支持 Skyline 热重载，首次编译检测到任意应用或页面配置使用 `renderer: 'skyline'` 时，会显示兼容性警告、自动将项目私有配置中的 `compileHotReLoad` 设为 `false`，并强制降级到 `classic`。切回 WebView 后可按需手动重新开启热重载。修改 DevTools 设置后请重启 `wv dev`；CSS、资源、配置和不兼容更新会自动回退完整构建与当前路由重载。

> 说明：CLI 同时支持完整命令 `weapp-vite` 与简写命令 `wv`，两者等价。下面的示例默认使用 `weapp-vite`，你也可以按个人习惯替换成 `wv`。

### Web 项目

项目根目录提供引用 `/@weapp-vite/web/entry` 的 `index.html` 后，可以直接运行同一份小程序源码：

```bash
wv dev -p web --host
wv build -p web
```

`web` 是浏览器 runtime 的规范平台名，`h5` 仅作为向后兼容别名保留；未选择 Web 平台时不改变现有小程序构建。完整配置和兼容边界见 [Web 运行时配置](https://vite.weapp.dev/config/web) 与 [`@weapp-vite/web`](https://vite.weapp.dev/packages/web)。

### Dashboard 嵌入 Vite DevTools

`weapp-vite/dashboard` 是 Node 端共享核心；CLI 独立工作台与 Vite DevTools 复用同一个 `DevframeDefinition` 和 `@weapp-vite/dashboard` 面板。可选适配器位于 `weapp-vite/dashboard/vite`，使用官方 `createPluginFromDevframe`，不会由普通包入口或 CLI 自动加载。

接入方安装 `@weapp-vite/dashboard`、`@vitejs/devtools` 和 `@vitejs/devtools-kit`。当前接入按 Vite `8.3.0`、DevTools / Kit `0.7.6`、Devframe `1.1.0` 验证；Kit 是可选 peer，宿主依赖不进入小程序产物。

```ts
import type { DevToolsConfig } from '@vitejs/devtools/config'
import type { DashboardAnalyzeSnapshot, DashboardContentRoots } from 'weapp-vite/dashboard'
import { DevTools } from '@vitejs/devtools'
import { createAnalyzeDashboardDevframe, resolveDashboardClientAssets } from 'weapp-vite/dashboard'
import { createAnalyzeDashboardPlugin } from 'weapp-vite/dashboard/vite'

export function createDashboardHost(snapshot: DashboardAnalyzeSnapshot, roots: DashboardContentRoots) {
  const dashboard = createAnalyzeDashboardDevframe({
    snapshot,
    roots,
    clientAssets: resolveDashboardClientAssets(roots.projectRoot),
  })
  const hostOptions: DevToolsConfig = {
    builtinDevTools: false,
    clientAuth: true,
    allowedOrigins: [],
    mcp: false,
  }
  return {
    dashboard,
    plugins: [
      DevTools(hostOptions),
      createAnalyzeDashboardPlugin(dashboard, { base: '/tools/weapp/' }),
    ],
  }
}
```

将返回的 `plugins` 交给 Vite 配置。调用方先完成分析及历史元数据持久化，用 `createDashboardArtifactSnapshot().capture` 收集该次分析的产物，再提交 `{ current, previous, artifacts }`。后续调用 `dashboard.update(result, artifacts, previousResult?)`；仅运行事件变化时调用 `dashboard.emitRuntimeEvents(events)`。提交后不要再修改报告或产物 Map。

每个控制器只同时挂载到一个逻辑宿主。适配器记录成功安装的 Vite 配置身份，并仅在该配置拥有的环境关闭时释放核心。成功重启将所有权移交给新配置，旧实例和未安装的失败候选的清理都不会误释放当前控制器；替换前的资源校验失败时，旧宿主仍可查询和更新。首次 setup 失败或 SDK 安装开始后的失败会释放核心，不承诺回滚部分安装。自行使用 `dashboard.definition` 对接其他 Devframe 宿主时，调用方必须负责最终关闭和启动失败时的 `dashboard.dispose()`。核心不启动服务器，也不拥有外部宿主的认证、Origin 或 MCP 策略；共享宿主不是只读沙箱。

DevTools `0.7.6` 自身存在程序化重启边界：重复使用同一个 `DevTools()` 返回值时，旧实例关闭可能同时关闭新实例的 WebSocket；不安装 Dashboard 也能复现。应在每次重载的 Vite 配置中重新调用 `DevTools()`，不要把该 SDK 插件实例长期缓存在复用的 inline 配置里。上述重启验证使用重新创建的 SDK 宿主和保留的 Dashboard 控制器，不代表修复了上游传输问题。

面板默认位于 `/__weapp-vite/`，自定义目录与应用 `base` 独立。前端复用宿主连接或从页面相对位置发现元数据，复制视图链接保留目录和查询参数但排除认证 fragment。适配器只在开发模式挂载，生产构建不要求可选面板资源，也不导出报告。以上入口仅用于 Node 开发 / 构建宿主，不应导入小程序 AppService。

仓库内可通过 `apps/dashboard-ui-lab` 的 `dev:inspector` 与 `dev:inspector:host` 验证两种宿主，详见其 [实验说明](../../apps/dashboard-ui-lab/README.md)。

### Vue 项目

```typescript
// vite.config.ts 或 weapp-vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    wxml: { remove: { comment: true } },
    vue: {
      enable: true,
      template: {
        htmlTagToWxml: true,
        htmlTagToWxmlTagClass: true,
      },
    },
  },
})
```

如果你在把传统 HTML/Vue 模板迁移到小程序 `.vue`，这两个模板配置通常最有用：

- `weapp.vue.template.htmlTagToWxml`
  把 `div/span/img/a/h1...` 等常见 HTML 标签映射成小程序内置标签。
- `weapp.vue.template.htmlTagToWxmlTagClass`
  默认开启。在映射发生时追加原标签名 class，例如 `h3 -> <view class="h3">`、`br -> <view class="br" />`，便于你自己写 CSS 低成本恢复默认外观；不需要时可设为 `false`。
- `weapp.vue.template.slotFallbackWrapper`
  微信平台默认会用内部 `virtualHost` 组件承载普通具名插槽 fallback，减少 `view` wrapper 的布局影响；需要回到旧行为可配置 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'` 或显式 `slotFallbackWrapper: 'view'`。`slotFallbackWrapper` 仍支持全局默认、按模板标签名 `component` / 子组件静态 `defineOptions({ name })` 的 `componentName` / slot 规则，以及组件内 `slot-wrapper` / `slot-wrapper-class` 静态覆盖。单个 slot 的局部策略更推荐写在对应的 `<template #xxx>` 上，例如 `<template #header slot-wrapper="cover-view">`。转发 `<slot />` 时不要使用 `<block slot="...">` 作为 wrapper，真实 DevTools 运行时会丢内容。

```vue
<!-- App.vue -->
<script setup>
import { ref } from 'vue'

const message = ref('Hello Vue in Mini-program!')

function handleClick() {
  console.log('Button clicked!')
}
</script>

<template>
  <view class="container">
    <text>{{ message }}</text>
    <button @click="handleClick">
      Click
    </button>
  </view>
</template>

<style scoped>
.container {
  padding: 20rpx;
}
</style>
```

📚 **完整文档**: [Vue 支持文档](./test/vue/README.md)

### 一方维护的 i18n

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    i18n: {
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    },
  },
})
```

默认扫描 `src/**/i18n/*.json`。Native Component 和使用 Component 构造的 Page 通过 `behaviors: [i18n.behavior]` 接入；传统 `Page({...})` 使用 `i18n.page(options)` 适配生命周期。Vue/Wevu 使用 `defineOptions({ behaviors: [i18n.behavior] })`。模板中的 `t('key', params)` 会在构建时改写为 WXS 调用；逻辑层从 `weapp-vite/i18n` 导入构建实例，并通过 `i18n.global` 访问翻译和 locale。

底层运行时与 catalog 编译器由独立包 `@weapp-vite/i18n` 提供，也可以在完全不使用 Vite 的原生微信小程序中安装。v1 只支持 `{name}` / `{user.name}` 占位符，不自动持久化语言，也不包含 ICU、复数和日期/数字格式化。完整配置见 [i18n 配置](https://vite.weapp.dev/config/i18n)。

- 配置智能提示文档：[docs/volar.md](./docs/volar.md)
- defineConfig 重载说明：[docs/define-config-overloads.md](./docs/define-config-overloads.md)
- Vite 插件识别 weapp-vite 宿主：https://vite.weapp.dev/guide/vite-plugin-host
- MCP 集成使用指南：[docs/mcp.md](./docs/mcp.md)
- Wot UI 与 uni-app 组件库：[docs/packaged/uni-app-component-libraries.md](./docs/packaged/uni-app-component-libraries.md)

## AI 项目指引

通过 `create-weapp-vite` 创建的新项目，现在会默认携带一个根目录 `AGENTS.md`。同时，`weapp-vite` npm 包会随版本发布一份本地文档目录：`node_modules/weapp-vite/dist/docs/`。

这个文件会告诉常见 AI 编程代理：

- 安装依赖后，优先阅读 `node_modules/weapp-vite/dist/docs/README.md`、`node_modules/weapp-vite/dist/docs/mcp.md` 等本地版本文档
- CLI 同时支持 `weapp-vite` 与 `wv`
- 需要做小程序截图采集时，优先使用 `weapp-vite screenshot` / `wv screenshot`
- 需要做小程序截图对比验收时，优先使用 `weapp-vite compare` / `wv compare`
- 不要把小程序运行时截图退化成通用浏览器截图
- 需要看 DevTools 终端日志时，优先使用 `weapp-vite ide logs --open` 或 `wv ide logs --open`
- 评估 Rust/native 加速时，优先减少 JS 与 Rust 的往返次数；同一份源码上的多个 AST 分析应尽量批量传入、一次 parse、一次返回结构化结果，并保留 Babel/Oxc/Vue compiler fallback

推荐把下面这组意图映射写进项目根 `AGENTS.md`，让常见 AI 更稳定命中：

- 提到 `截图`、`页面快照`、`runtime screenshot`
  - 默认使用 `weapp-vite screenshot` / `wv screenshot`
- 提到 `截图对比`、`diff`、`baseline`、`视觉回归`、`像素对比`
  - 默认使用 `weapp-vite compare` / `wv compare`
- 提到 `运行时日志`、`DevTools 日志`
  - 默认使用 `weapp-vite ide logs --open` / `wv ide logs --open`

`dist/docs` 当前会内置这些文件：

- `README.md`
- `getting-started.md`
- `ai-workflows.md`
- `project-structure.md`
- `weapp-config.md`
- `i18n.md`
- `uni-app-component-libraries.md`
- `wevu-authoring.md`
- `vue-sfc.md`
- `troubleshooting.md`
- `mcp.md`
- `volar.md`
- `define-config-overloads.md`
- `index.md`

推荐的截图命令示例：

```sh
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json

# 等价写法
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

推荐的截图对比命令示例：

```sh
weapp-vite compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json

# 等价写法
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
```

## DevTools 日志桥接

`weapp-vite` 现在支持把微信开发者工具里的小程序 `console` 输出桥接到当前终端。

默认行为：

- `weapp.forwardConsole` 默认是 `enabled: 'auto'`
- 当检测到当前运行环境是 AI 终端时，`weapp-vite dev --open` 会自动尝试附加日志桥
- 也可以手动进入持续监听模式

配置示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    forwardConsole: {
      enabled: 'auto',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    },
  },
})
```

手动启动持续监听：

```sh
weapp-vite ide logs
weapp-vite ide logs --open
# 等价写法
wv ide logs
wv ide logs --open

# 检查 DevTools CLI、服务端口、登录和已打开 automator 会话
wv ide doctor
wv ide doctor --json
```

`wv open`、`wv dev -o`、`wv build -o` 和 `wv ide logs --open` 默认使用官方 CLI 打开项目，再连接 automator。需要调试旧版自动化启动链路时，可显式传入 `--ide-open-strategy automator`；项目自动信任与打开策略相互独立。

除了日志桥接，`ide` 子命令现在也支持直接读取已打开 DevTools 会话的信息：

```sh
wv ide info
wv ide test-accounts
wv ide ticket
wv ide ticket:set --ticket your-ticket
wv ide ticket:refresh
```

## DevTools 配置预热

`weapp-vite` 在打开微信开发者工具前，会复用 `weapp-ide-cli` 的底层能力，自动尝试预热本机 DevTools 配置：

- 确保安全设置中的服务端口处于开启状态
- 按命令参数或全局配置决定是否自动信任当前项目

如果你只想预热配置、不立即打开 IDE，可以使用：

```sh
weapp-vite ide setup .
# 等价写法
wv ide setup .
```

如果你希望以后 `open` / `dev --open` / `build --open` 都默认自动信任项目，直接配置 `weapp-ide-cli` 即可：

```sh
weapp config set autoBootstrapDevtools true
weapp config set autoTrustProject true
```

这样以后执行：

```sh
weapp-vite open .
weapp-vite dev --open
weapp-vite build --open
```

都会沿用同一套默认策略。

## Dev 开发快捷键

当你使用 `weapp-vite dev --open` 启动微信开发者工具后，终端会自动进入开发快捷键模式，方便直接在当前会话里执行高频调试动作。

当前默认快捷键：

- `h`：重新显示帮助
- `q`：退出当前 `dev`
- `s`：截图当前页面并保存到本地
- `r`：手动重新构建当前小程序产物
- `c`：重置当前 DevTools automator 会话
- `C`：重置会话并重开当前微信开发者工具项目
- `o`：重新打开当前微信开发者工具项目
- `m`：开关本地 MCP 服务
- `Ctrl+C`：强制中断当前 `dev`
- `Ctrl+Z`：临时挂起当前 `dev`，恢复终端控制

执行动作时，终端会显示“执行中”状态和最近一次操作结果；如果当前已有热键动作在运行，会自动阻止并发执行，避免和开发者工具会话互相踩踏。

常见组合示例：

```sh
weapp-vite dev --open
# 启动后可直接在终端里按：
# r -> 手动重新构建
# c -> 重置当前 DevTools 会话
# C -> 重置会话并重开项目
# o -> 重新打开当前 DevTools 项目
```

## 六端构建并上传

显式执行 `wv build --upload`，在本次构建成功并校验产物后上传，不重复构建。支持微信 `weapp`、支付宝 `alipay`、抖音 `tt`、小红书 `xhs`、京东 `jd`、百度 `swan`；只上传开发版本，不自动提审或正式上线。

```sh
wv build --upload --dry-run
wv build --upload -p weapp

# 独立 upload 命令仍支持多个小程序目标；all 在此表示六端
wv upload --platform jd,swan
wv upload --platform all --dry-run

# 内置本地自动版本演练，不修改版本或锁文件
wv upload -p xhs,tt --mode test --bump patch --git-desc --dry-run
```

通常无需配置 `weapp.upload`：默认读取业务 `package.json.version`，说明自动生成 `项目名@版本`；默认不升版、不读取 Git、不运行 npm。需要覆盖时用 `weapp.upload` 或 CLI `--uv` / `--desc`；本地自动版本显式使用 CLI `--bump patch|minor|major` / `--git-desc`，分别与 `--uv` / `--desc` 冲突，不写入 Vite 配置。`.env.test` / `.env.production`、不同 AppID、本地自动版本与 CI 方案见[上传环境与自动版本](https://vite.weapp.dev/guide/upload/environments.html)。普通 `build`、`dev/HMR` 不上传，`preview` 不使用上传默认参数；配置文件仍正常求值。`build` 的上传专属参数必须与 `--upload` 一起使用，不支持 `--watch` 或 Web-only。

自动元数据在首次配置求值、编译前准备一次，批量共用；升版仅处理命令根目录的应用清单，不向父目录查找。真实升版需要本机 npm，只有 Git 说明要求已有提交的 Git 仓库；不执行生命周期钩子、不 commit/tag/push。dry-run 不运行 npm、不修改版本或锁文件，直接导入 `package.json` 的构建代码仍读取原始版本。实际升版后的构建或上传失败不回滚，重试去掉 `--bump` 并复用原版本，必要时用 `--uv` / `--desc` 固定上一批元数据。

`build -p all --upload` 保持“小程序 + Web”语义，等两个后端都构建成功后只上传小程序；独立 `wv upload -p all` 才是六端逐一构建上传，首次失败停止。`--dry-run` 只构建并校验产物，不校验凭据、不调用 SDK。

多个平台可用一份 `weapp.multiPlatform.projectConfigs` 映射集中配置 AppID，公共字段用对象展开复用，不必手工维护六份原生 JSON。构建器在代码输出目录内生成对应项目配置；原生文件方式仍可使用。完整配置见[一份配置与批量上传](https://vite.weapp.dev/guide/upload.html#batch)。

官方工具按目标安装，凭据只使用环境变量，不在 `weapp.upload` 中配置。完整的项目配置、AppID、凭据获取与环境文件、上传、预览、批量操作、CI 与排障见[小程序上传与预览指南](https://vite.weapp.dev/guide/upload.html)：[小红书](https://vite.weapp.dev/guide/upload/xhs.html)、[抖音](https://vite.weapp.dev/guide/upload/tt.html)、[微信](https://vite.weapp.dev/guide/upload/weapp.html)、[支付宝与淘宝边界](https://vite.weapp.dev/guide/upload/alipay.html)、[京东](https://vite.weapp.dev/guide/upload/jd.html)、[百度](https://vite.weapp.dev/guide/upload/swan.html)。本地速查见 `dist/docs/upload.md`；淘宝暂不支持，不要用 `-p alipay` 替代。

## 六端构建并预览

```sh
wv preview -p tt --mode test
wv preview -p xhs,jd,swan --mode production
wv preview -p all --dry-run
```

`preview` 复用上述六端构建与凭据，调用官方预览接口，不上传开发版本、不提审、不正式发布。微信返回 `.weapp-vite/preview/` 下本次生成的二维码图片；支付宝、京东返回二维码图片 URL；抖音、小红书、百度返回官方预览链接。默认 mode 为 `production`，不要求上传版本，也不接受 `--uv`、`--bump` 或 `--git-desc`。百度预览也需要 `SWAN_MIN_VERSION`。

`--dry-run` 只构建和校验产物，不调用 SDK、不生成预览结果。真实扫码权限与有效期依平台规则，详情见 [CLI 预览文档](https://vite.weapp.dev/guide/cli.html)。

## CLI 中调用 weapp-ide-cli

`weapp-vite` 内置了对 `weapp-ide-cli` 的透传能力：原生命令通常优先，其他命令仅在 IDE catalog 命中时透传。`wv upload` 默认走六端 SDK，但保留带明确旧参数的顶层微信 IDE 上传；`wv preview` 仍是 SDK 预览，不属于旧语法兼容范围。稳定的显式 `ide upload`、`ide preview` 不弃用：

```sh
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide upload --project ./dist/build/mp-weixin -v 1.0.0 -d "release"
weapp-vite cache --clean compile
weapp-vite cache --clean all
weapp-vite config lang zh
weapp-vite config set autoTrustProject true
weapp-vite navigate pages/index/index --project ./dist/build/mp-weixin
# 等价写法
wv ide preview --project ./dist/build/mp-weixin
wv cache --clean all
```

也支持命名空间写法：

```sh
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide config show
weapp-vite ide setup .
weapp-vite ide logs --open
# 等价写法
wv ide preview --project ./dist/build/mp-weixin
```

原有顶层上传的长、短参数仍可原样执行，不额外触发 weapp-vite 构建：

```sh
wv upload --project ./dist --version 1.2.3 --desc "release"
wv upload -p ./dist -v 1.2.3 -d "release"
```

新 SDK 上传使用 `wv upload -p weapp` 即可，无需 `--project`，框架按项目配置与本轮实际输出自动定位。上面 `./dist` 只是旧 IDE 工程目录示例，应包含 `project.config.json`；旧入口省略定位参数时保持透传，不会默认补 `dist`。

每次旧顶层调用只警告一次未来移除，不要求立即改写脚本；若只想保留 IDE 行为，改为 `wv ide upload -p ./dist -v 1.2.3 -d "release"`，该显式入口不警告。若迁移到 SDK，先在**源码项目根**安装 `miniprogram-ci`、配置 AppID、代码上传私钥与 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`。SDK 会重新构建、使用新凭据，不复用 IDE 登录；不要把旧 `--project` 的产物目录直接作为 `[root]`。

`-p` 有 `--version/-v`、`--project`、`--appid`、`--ext-appid` 或 `--info-output/-i` 等旧标记时才表示 IDE 项目目录，否则表示平台，不猜测路径。旧标记与 SDK 的 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`（含其 `--no-*` 形式）混用，在 IDE、编译或版本修改前报错；SDK dry-run/自动版本不适用于 IDE。`--desc` 共用，`-d` 只在旧调用中是说明，原生命令中仍是 debug。

`wv upload --help` 查看 SDK 帮助；`wv help upload` 保留旧 IDE 帮助并提示未来弃用；`wv ide help upload` 不弃用、不警告。等号写法、选项值与 `--` 边界等完整规则见[旧上传兼容与迁移](https://vite.weapp.dev/guide/cli.html#legacy-upload)。

## CLI 启动 MCP

`weapp-vite` 已集成 `@weapp-vite/mcp`：

- 默认不自动启动 MCP 服务（可通过配置开启自动启动）
- 优先推荐直接生成客户端配置，而不是手写 MCP 地址

```sh
wv mcp init codex
wv mcp init claude-code
wv mcp init cursor
```

只预览配置、不写入：

```sh
wv mcp print codex
```

检查配置是否可用：

```sh
wv mcp doctor codex
```

如果已经手动启动 HTTP MCP 服务：

```sh
wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp
```

接入后，AI 可以直接使用 `take_weapp_screenshot`、`compare_weapp_screenshot`，也可以用 `weapp_devtools_connect`、`weapp_devtools_route`、`weapp_devtools_capture`、`weapp_devtools_console` 与 `weapp_runtime_*` 工具检查真实小程序运行时。

仍然需要手动启动 MCP Server 时：

```sh
weapp-vite mcp
# 等价写法
wv mcp
```

指定工作区根路径：

```sh
weapp-vite mcp --workspace-root <repo-root>
# 等价写法
wv mcp --workspace-root <repo-root>
```

在 `vite.config.ts` 或 `weapp-vite.config.ts` 中开启自动启动：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      autoStart: true,
    },
  },
})
```

详细说明见：[docs/mcp.md](./docs/mcp.md)

## 小程序页面与组件测试

`buildTestArtifact()` 会通过 Vite/Rolldown 把真实编译产物输出到隔离目录，供 mpcore 测试环境消费：

```ts
import { buildTestArtifact } from 'weapp-vite/test'

const artifact = await buildTestArtifact({ cwd: process.cwd() })
```

默认输出目录是 `.weapp-vite/test-artifacts/`。完整的 render、查询、交互和 Vitest 接入见 [测试指南](./docs/packaged/testing.md)。

## Contribute

我们邀请你来贡献和帮助改进 `weapp-vite` 💚💚💚

以下有几个方式可以参与:

- 报告错误：如果您遇到任何错误或问题，请提`issue`并提供完善的错误信息和复现方式。
- 建议：有增强 `weapp-vite` 的想法吗？请提 `issue` 来分享您的建议。
- 文档：如果您对文档有更好的见解或者更棒的修辞方式，欢迎 `pr`。
- 代码：任何人的代码都不是完美的，我们欢迎你通过 `pr` 给代码提供更好的质量与活力。

## License

[MIT](./LICENSE)

<!-- "//------":""esbuild": "^0.21.3",", -->

## 实验性标准 Vite 插件

`weapp-vite/vite` 导出 `weapp()`，通过 `plugins: [weapp()]` 和顶层 `weapp` 配置接入原生 `vite build` / `vp build`。当前开放微信 TS/Vue/React 生产构建、原生 build watch 与实验性 classic/stateful 开发；高级目标继续分阶段对齐。配置、Vite+ alias 与未开放能力见 [标准插件指南](https://vite.weapp.dev/guide/vite-plugin)。离线说明随包发布在 `dist/docs/vite-plugin.md`。
