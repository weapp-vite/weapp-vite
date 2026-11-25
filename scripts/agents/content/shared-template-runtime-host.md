## Mini-program Runtime Host APIs

- 小程序 AppService 不是浏览器或 Node.js。新增 `queueMicrotask`、Web API、DOM/Node 全局或现代内建前，必须先在目标平台的真实 IDE、目标基础库和 renderer 中探测存在性与最小调用语义；浏览器、Node、类型声明和 headless simulator 结果都不能替代真实 IDE 证据。
- 微信运行时不得假定存在 `queueMicrotask`。即使某个 DevTools 版本探测为可用，也必须使用显式兼容层，或确认项目已经启用对应的 weapp-vite runtime global 注入。
- 项目 ESLint 配置应接入 `@weapp-vite/eslint` 的 `miniProgramRuntimeRecommended` 或 `createMiniProgramRuntimeConfig()`，只检查会进入小程序运行时的 `src` 代码；config、构建脚本、测试、Web-only、WXS 和生成产物不纳入该规则。

## Testing and E2E

- 模板需要页面或组件测试时，直接从 `vitest` 导入 `test`、`it`、`expect` 和 hooks，从 `weapp-vite/test` 导入构建产物、headless simulator、页面查询、交互和 matcher，从 `weapp-vite/e2e` 导入真实 DevTools automator；不要在模板中安装 `@mpcore/test`、`@mpcore/vitest` 或 `@mpcore/weapp-vite`。
- headless 验证使用真实 weapp-vite 编译产物创建独立测试项目，每个测试在结束时关闭 project；不要把源码目录直接交给 simulator，也不要共享正在运行的 session。
- 真实微信开发者工具验证复用仓库 `e2e/ide/**` 的 provider-compatible suite，或调用 `weapp-vite/e2e` 暴露的 automator API。先用 `weapp-vite/test` headless provider 验证逻辑和页面状态，再在具备官方 DevTools 环境时运行对应 DevTools provider；不要为模板新增 `acceptance/*.json` 或专用 acceptance 配置。
