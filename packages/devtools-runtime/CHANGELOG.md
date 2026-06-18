# @weapp-vite/devtools-runtime

## 0.4.5

### Patch Changes

- 📦 **Dependencies** [`1e8dc3d`](https://github.com/weapp-vite/weapp-vite/commit/1e8dc3d5dfa0cbbb409b304c2dc3ebac97b7443b)
  → `@weapp-vite/miniprogram-automator@1.2.4`

## 0.4.4

### Patch Changes

- 📦 **Dependencies** [`7df6ac4`](https://github.com/weapp-vite/weapp-vite/commit/7df6ac4c8dfc677aeb63b370c6a835a5baa0c51d)
  → `@weapp-vite/miniprogram-automator@1.2.3`

## 0.4.3

### Patch Changes

- 🐛 **修复 `weapp-vite dev -o` 通过 automator 打开带 `miniprogramRoot` 项目时可能切到临时哈希目录的问题。开发模式现在直接打开真实项目目录，打开后的 HTTP 编译刷新失败时也不会回退到会创建临时 wrapper 的 automator 编译；开发态 `s` 截图热键会保留真实项目根，避免微信开发者工具监听临时拷贝导致后续热更新失效。** [`9799aa2`](https://github.com/weapp-vite/weapp-vite/commit/9799aa221f999a1dbd28ab95b21723336e8de680) by @sonofmagic

- 🐛 **修复多个 TailwindCSS 模板同时执行 `pnpm dev:open` 时，截图、MCP 与其他微信开发者工具联动可能连接到默认全局 automator 端口或其他项目窗口的问题。开发态普通 open 后会为真实项目根目录准备独立的默认 automator 会话，MCP runtime 默认保留真实项目根目录，确保多开场景下各模板的热更新、截图和运行时调试都绑定到自己的项目。** [`16150fa`](https://github.com/weapp-vite/weapp-vite/commit/16150fa2039be50c0cd124688bdc43266181800d) by @sonofmagic

## 0.4.2

### Patch Changes

- 📦 **Dependencies** [`90f71b0`](https://github.com/weapp-vite/weapp-vite/commit/90f71b013cd6314977d3054fedbbc043eb24dcfd)
  → `@weapp-vite/miniprogram-automator@1.2.2`

## 0.4.1

### Patch Changes

- 🐛 **修复 DevTools 自动化会话生命周期与截图恢复逻辑，为 wevu + Tailwind CSS + TDesign 模板补充稳定选择器，并把真实 IDE 打开、截图、DOM 操作与登录失效诊断流程纳入 e2e 覆盖。** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad) by @sonofmagic
- 📦 **Dependencies** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad)
  → `@weapp-vite/miniprogram-automator@1.2.1`

## 0.4.0

### Minor Changes

- ✨ **支持按端口或 sessionId 区分多个 DevTools automator 会话，并为自动启动流程增加并发安全的端口租约，避免多个自动化任务同时启动时争抢同一个 websocket 端口。** [#661](https://github.com/weapp-vite/weapp-vite/pull/661) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`643c2fe`](https://github.com/weapp-vite/weapp-vite/commit/643c2fe8c0e64d3a817503d3080162b51c0d314a)
  → `@weapp-vite/miniprogram-automator@1.2.0`

## 0.3.2

### Patch Changes

- 📦 **Dependencies** [`3eb68b6`](https://github.com/weapp-vite/weapp-vite/commit/3eb68b6e3d31ffc29c90c4c29a44ce0fc05fd1ea)
  → `@weapp-vite/miniprogram-automator@1.1.3`

## 0.3.1

### Patch Changes

- 📦 **Dependencies** [`28bade7`](https://github.com/weapp-vite/weapp-vite/commit/28bade743e164d87316fd8949d6c82fd3dda1e07)
  → `@weapp-vite/miniprogram-automator@1.1.2`

## 0.3.0

### Minor Changes

- ✨ **新增 `weapp mcp` 标准 MCP 入口，让 AI 客户端可以直接连接微信开发者工具 automator 会话，并调用页面读取、元素查询、点击输入、截图与基础宿主 API 工具完成小程序模拟器里的 E2E 验证。** [`f41e375`](https://github.com/weapp-vite/weapp-vite/commit/f41e37591bb104b03ae9e7d60ae4499e46ce37fb) by @sonofmagic
  - 同时将 DevTools MCP 的路径解析、结构化输出序列化和元素快照读取抽到 `@weapp-vite/devtools-runtime` 公共模块，供 `@weapp-vite/mcp` 与 `weapp-ide-cli` 复用，避免两套 MCP 入口重复维护基础运行时契约。

## 0.2.3

### Patch Changes

- 📦 **Dependencies** [`4276782`](https://github.com/weapp-vite/weapp-vite/commit/4276782841181ef7b540be4eb5e722e979f4363f)
  → `@weapp-vite/miniprogram-automator@1.1.1`

## 0.2.2

### Patch Changes

- 📦 **Dependencies** [`f0d3142`](https://github.com/weapp-vite/weapp-vite/commit/f0d3142250ec0ac70329215009ef5f0cff144ad9)
  → `@weapp-vite/miniprogram-automator@1.1.0`

## 0.2.1

### Patch Changes

- 📦 **Dependencies** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873)
  → `@weapp-vite/miniprogram-automator@1.0.5`

## 0.2.0

### Minor Changes

- ✨ **为 MCP 服务新增微信开发者工具 runtime 工具集，并抽出共享 DevTools runtime 会话包，支持连接复用、页面跳转、截图、日志读取、页面数据、元素查询和组件交互等自动化能力。** [#527](https://github.com/weapp-vite/weapp-vite/pull/527) by @sonofmagic
