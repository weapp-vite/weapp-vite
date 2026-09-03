## Mini-program Runtime Host APIs

- 小程序 AppService 不是浏览器或 Node.js。新增 `queueMicrotask`、Web API、DOM/Node 全局或现代内建前，必须先在目标平台的真实 IDE、目标基础库和 renderer 中探测存在性与最小调用语义；浏览器、Node、类型声明和 headless simulator 结果都不能替代真实 IDE 证据。
- 微信运行时不得假定存在 `queueMicrotask`。即使某个 DevTools 版本探测为可用，也必须使用显式兼容层，或确认项目已经启用对应的 weapp-vite runtime global 注入。
- 项目 ESLint 配置应接入 `@weapp-vite/eslint` 的 `miniProgramRuntimeRecommended` 或 `createMiniProgramRuntimeConfig()`，只检查会进入小程序运行时的 `src` 代码；config、构建脚本、测试、Web-only、WXS 和生成产物不纳入该规则。
