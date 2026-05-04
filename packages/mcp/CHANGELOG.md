# @weapp-vite/mcp

## 1.3.1

### Patch Changes

- 🐛 **修复 DevTools console 日志启用超时时可能导致常驻 MCP/REST 服务退出的问题，并让 streamable-http MCP 服务使用带会话的 transport，确保标准 MCP client 可以完成初始化和工具发现。** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873) by @sonofmagic

- 🐛 **为 streamable-http MCP 服务新增 DevTools runtime REST 接口，支持通过 HTTP 连续连接、跳转、截图、读取页面信息和日志，并让 `weapp-vite` 的 MCP 配置与 CLI 支持 `restEndpoint` 开关。** [`bc7e9e3`](https://github.com/weapp-vite/weapp-vite/commit/bc7e9e351d55811781a8aad71815f100cd71a59b) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.2.1`

## 1.3.0

### Minor Changes

- ✨ **为 MCP 服务新增微信开发者工具 runtime 工具集，并抽出共享 DevTools runtime 会话包，支持连接复用、页面跳转、截图、日志读取、页面数据、元素查询和组件交互等自动化能力。** [#527](https://github.com/weapp-vite/weapp-vite/pull/527) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`a3451df`](https://github.com/weapp-vite/weapp-vite/commit/a3451df4f907a58d7ba1c7ebaa78bd215c017da4)
  → `@weapp-vite/devtools-runtime@0.2.0`

## 1.2.1

### Patch Changes

- 🐛 **修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75) by @sonofmagic

## 1.2.0

### Minor Changes

- ✨ **增强 weapp-vite 的 AI 亲和性：为 MCP 新增显式的截图与截图对比工具，补充随包文档和网站中的 AI 意图映射说明，并让 create-weapp-vite 生成的项目级 AGENTS 指引默认把截图与截图对比请求路由到 weapp-vite 的原生命令能力。** [`933826c`](https://github.com/weapp-vite/weapp-vite/commit/933826cbd52e0de267069c4b67d0e6b8a669afdb) by @sonofmagic

## 1.1.2

### Patch Changes

- 🐛 **修复 `weapp-vite mcp` 在普通安装项目中的路径解析问题。现在 MCP 服务会优先识别 monorepo 布局，在用户项目里则回退到 `node_modules` 下已安装的 `weapp-vite` / `wevu` / `@wevu/compiler` 包路径，不再错误假设存在 `packages/weapp-vite/package.json`。同时补充安装态 CLI 入口与本地随包文档的回归覆盖，避免 `npx weapp-vite mcp` 启动时因 `ENOENT` 直接失败。** [#386](https://github.com/weapp-vite/weapp-vite/pull/386) by @sonofmagic

## 1.1.1

### Patch Changes

- 🐛 **优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140) by @sonofmagic

## 1.1.0

### Minor Changes

- ✨ **重构 `@weapp-vite/mcp` 为面向 `weapp-vite / wevu` 的完整 MCP 服务，实现包目录发现、源码读取与检索、包脚本执行、`weapp-vite` CLI 调用、文档资源暴露与调试提示词模板，并补充对应测试与使用文档。** [`a7768a3`](https://github.com/weapp-vite/weapp-vite/commit/a7768a31befe085638950e1dd54bb9da85f2ee50) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 1.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 0.0.5

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.4

### Patch Changes

- [`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.3

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

## 0.0.2

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.2-alpha.0

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.1

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade
