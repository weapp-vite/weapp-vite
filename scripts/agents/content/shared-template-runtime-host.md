## Mini-program Runtime Host APIs

- 小程序 AppService 不是浏览器或 Node.js。新增 `queueMicrotask`、Web API、DOM/Node 全局或现代内建前，必须先在目标平台的真实 IDE、目标基础库和 renderer 中探测存在性与最小调用语义；浏览器、Node、类型声明和 headless simulator 结果都不能替代真实 IDE 证据。
- 微信运行时不得假定存在 `queueMicrotask`。即使某个 DevTools 版本探测为可用，也必须使用显式兼容层，或确认项目已经启用对应的 weapp-vite runtime global 注入。
- 项目 ESLint 配置应接入 `@weapp-vite/eslint` 的 `miniProgramRuntimeRecommended` 或 `createMiniProgramRuntimeConfig()`，只检查会进入小程序运行时的 `src` 代码；config、构建脚本、测试、Web-only、WXS 和生成产物不纳入该规则。

## Acceptance Routing

- 当请求提到验收、acceptance 或 runtime verification 时，使用 `$weapp-acceptance`。先运行 `wv accept --inspect --json` 查看自动识别的 typecheck、build、test 检查和 `acceptance/*.json` 场景，再在用户授权执行项目脚本后运行 `wv accept --trust --json`。普通构建和 Vitest 验收不要求 `weapp-acceptance.config.json`；仅在需要自定义检查命令或验收策略时创建它。
- `@mpcore/vitest` 导出的 `test`/`it` 已提供隔离的 `mpcore` fixture，并重导出 Vitest 原生 `expect`。测试直接调用 `test(...)` 或 `it(...)`，不要再创建 `createMpcoreTest()` 局部入口。
- `acceptance/*.json` 用于微信开发者工具 runtime 场景，会被自动发现并加入必需检查。Vitest/mpcore 与 DevTools runtime 是不同证据，分别报告。插件、组件库和 React 模板默认只运行可识别的构建及类型检查。
