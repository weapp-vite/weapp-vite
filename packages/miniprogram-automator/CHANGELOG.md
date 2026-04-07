# @weapp-vite/miniprogram-automator

## 1.0.2

### Patch Changes

- 🐛 **修复微信开发者工具自动化会话在启动抖动阶段容易误判为“HTTP 服务端口未开启”的问题。现在会在 `Extension context invalidated`、websocket 启动超时等可恢复场景下自动重试一次，并在仍然失败时输出更贴近真实状态的错误分类。同步修正 `weapp-vite-tailwindcss-vant-template` 的布局演示页操作区排版，避免 `@vant/weapp` 按钮以内联方式挤压换行导致页面错乱。** [`b4cfb7b`](https://github.com/weapp-vite/weapp-vite/commit/b4cfb7b6503ee4fc8758b9275aabd5f57372dd3e) by @sonofmagic

- 🐛 **修复小程序截图链路在微信开发者工具无响应或自动化会话异常时的诊断行为，并为 `weapp-vite screenshot` / `wv screenshot` / `weapp-ide-cli screenshot` 新增 `--full-page` 整页长截图能力。现在截图命令会正确等待异步命令完成；当 DevTools websocket 连接失败、截图请求长时间不返回，或清理会话时 `App.exit` / `Tool.close` 无响应时，会显式抛出可排查的错误提示，而不再静默退出或表现为“成功但没有产物”；同时 `--page pages/...` 这类常见写法也会自动归一化为小程序路由所需的前导 `/`。** [`2a5882b`](https://github.com/weapp-vite/weapp-vite/commit/2a5882b016a6018ae5e5e73d48db11a3e0456676) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **将 `@weapp-vite/miniprogram-automator` 内部的二维码编码、解码与终端渲染能力提取为新的 `@weapp-vite/qr` 包，并让原有 automator API 改为复用该独立包实现，方便在仓库外单独安装与复用。** [`fcf09b3`](https://github.com/weapp-vite/weapp-vite/commit/fcf09b343c38ca1d5abe662dd15dd6d9414f1ab3) by @sonofmagic
- 📦 **Dependencies** [`fcf09b3`](https://github.com/weapp-vite/weapp-vite/commit/fcf09b343c38ca1d5abe662dd15dd6d9414f1ab3)
  → `@weapp-vite/qr@1.1.0`

## 1.0.0

### Major Changes

- 🚀 **重构 `weapp-ide-cli` 的命令行入口，改为基于 `cac` 的顶层命令注册与解析，同时继续保持现有微信开发者工具透传命令、automator 子命令、`config` 子命令与 `minidev` 转发入口的兼容行为。内部的 automator 会话层也已切换到现代化的 `@weapp-vite/miniprogram-automator` 命名导出与 `Launcher` 启动路径。** [`d94a443`](https://github.com/weapp-vite/weapp-vite/commit/d94a44378ad53b3b27019bed4855f782926147ff) by @sonofmagic
  - `@weapp-vite/miniprogram-automator` 现在只发布 ESM 产物，不再提供 CJS 入口。包导出与构建配置已经同步收敛为纯 ESM 形式，使用 `require()` 加载该包的旧调用方式将不再受支持。

### Minor Changes

- ✨ **新增 `@weapp-vite/miniprogram-automator` 包，作为对微信官方 `miniprogram-automator` 的现代化兼容替代实现，提供纯根入口 named exports、`MiniProgram / Page / Element / Native` 等核心类、内置二维码解析与终端渲染能力，并接入 `weapp-vite` 生态内的 headless 运行时适配能力。** [`a979852`](https://github.com/weapp-vite/weapp-vite/commit/a97985294bb7f2fd7321aafd28b0faad4d383c8e) by @sonofmagic
  - 同时将 `weapp-ide-cli` 与仓库内 e2e 运行时切换到新的 workspace automator 包，为后续完全替换官方依赖做准备。

## 0.0.0

- 初始实现
