<div align="center">
  <a href="https://vite.icebreaker.top">
    <img width="200" height="200" hspace="10" src="https://vite.icebreaker.top/logo.png" alt="vite logo" />
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

## 使用文档地址: [vite.icebreaker.top](https://vite.icebreaker.top)

## Features

- 🚀 **Vue 3 支持**：完整的 Vue 单文件组件（SFC）支持，使用 Vue 官方编译器
  - `<script setup>` 和 TypeScript 完整支持
  - 完整的模板语法（v-if、v-for、v-model 等）
  - Scoped CSS 和 CSS Modules
  - 动态组件、过渡动画、KeepAlive
  - [详细文档 →](./test/vue/README.md)

- ⚡️ **Vite 构建**：带来了 `typescript` / `scss` / `less` 等等的原生支持
- 🔌 **插件生态**：Vite 插件生态支持，也可以自定义编写插件，方便扩展
- 🧰 **IDE 命令增强**：可直接透传 `weapp-ide-cli` 全量命令（`preview/upload/config/automator` 等）

## 快速开始

> 说明：CLI 同时支持完整命令 `weapp-vite` 与简写命令 `wv`，两者等价。下面的示例默认使用 `weapp-vite`，你也可以按个人习惯替换成 `wv`。

### Vue 项目

```typescript
// vite.config.ts 或 weapp-vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    vue: {
      enable: true,
      template: {
        removeComments: true,
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

- 配置智能提示文档：[docs/volar.md](./docs/volar.md)
- defineConfig 重载说明：[docs/define-config-overloads.md](./docs/define-config-overloads.md)
- Vite 插件识别 weapp-vite 宿主：https://vite.icebreaker.top/guide/vite-plugin-host
- MCP 集成使用指南：[docs/mcp.md](./docs/mcp.md)

## AI 项目指引

通过 `create-weapp-vite` 创建的新项目，现在会默认携带一个根目录 `AGENTS.md`。同时，`weapp-vite` npm 包会随版本发布一份本地文档目录：`node_modules/weapp-vite/dist/docs/`。

这个文件会告诉常见 AI 编程代理：

- 安装依赖后，优先阅读 `node_modules/weapp-vite/dist/docs/README.md`、`node_modules/weapp-vite/dist/docs/mcp.md` 等本地版本文档
- CLI 同时支持 `weapp-vite` 与 `wv`
- 需要做小程序截图采集时，优先使用 `weapp-vite screenshot` / `wv screenshot`
- 需要做小程序截图对比验收时，优先使用 `weapp-vite compare` / `wv compare`
- 不要把小程序运行时截图退化成通用浏览器截图
- 需要看 DevTools 终端日志时，优先使用 `weapp-vite ide logs --open` 或 `wv ide logs --open`

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
- `c`：清理微信开发者工具 `compile` 缓存
- `C`：清理微信开发者工具全部缓存
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
# c -> 清 compile 缓存
# o -> 重新打开当前 DevTools 项目
```

## CLI 中调用 weapp-ide-cli

`weapp-vite` 内置了对 `weapp-ide-cli` 的透传能力，除了 `dev/build/open/init/generate/analyze/npm` 等原生命令外，其它 IDE 相关命令都可以直接调用：

```sh
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite upload --project ./dist/build/mp-weixin -v 1.0.0 -d "release"
weapp-vite cache --clean compile
weapp-vite cache --clean all
weapp-vite config lang zh
weapp-vite config set autoTrustProject true
weapp-vite navigate pages/index/index --project ./dist/build/mp-weixin
# 等价写法
wv preview --project ./dist/build/mp-weixin
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

## CLI 启动 MCP

`weapp-vite` 已集成 `@weapp-vite/mcp`：

- 默认不自动启动 MCP 服务（可通过配置开启自动启动）
- 优先推荐直接生成客户端配置，而不是手写 MCP 地址

```sh
wv mcp init codex
wv mcp init claude-code
wv mcp init cursor
```

检查配置是否可用：

```sh
wv mcp doctor codex
```

仍然需要手动启动 MCP Server 时：

```sh
weapp-vite mcp
# 等价写法
wv mcp
```

指定工作区根路径：

```sh
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
# 等价写法
wv mcp --workspace-root /absolute/path/to/weapp-vite
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
