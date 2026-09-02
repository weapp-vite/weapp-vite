## 6. Security and Environment

- Node.js 20+ with compatible pnpm.
- For `weapp-ide-cli` operations (`open`, `preview`, `upload`), ensure WeChat DevTools service port is enabled.
- Never commit secrets; use `.env.local` or environment variables.
- 对小程序运行时代码、会进入小程序产物的兼容层代码、以及依赖微信/支付宝/抖音等宿主执行的 bundle 代码，一律不要依赖 `eval`、`new Function`、`Function("return this")()`、字符串定时代码，或任何需要动态求值的能力。
- 处理小程序运行时全局对象兼容时，优先使用静态宿主解析、显式别名同步、编译期注入和可测试的直接引用；不要把“动态执行可用”当作默认前提。

### 6.1 VS Code Workspace Hygiene

- 根目录 `.vscode/settings.json` 是本仓库的 IDE 性能基线之一；不要随意删除或放宽 `files.exclude`、`files.watcherExclude`、`search.exclude`、`tailwindCSS.files.exclude`、`i18n-ally.usage.scanningIgnore` 中针对大体积生成物和缓存目录的排除规则。
- 当前需要保持排除一致的高噪音目录至少包括：
  - `.cache`
  - `.codex-tmp`
  - `.minidev`
  - `.playwright`
  - `.playwright-cli`
  - `.pnpm-store`
  - `.tmp`
  - `.turbo`
  - `.weapp-vite`
  - `.wevu-config`
  - `dist`
  - `coverage`
  - `docs/reports`
  - `node_modules`（至少对 watcher/search 保持排除）
- 当仓库新增新的缓存目录、临时目录、生成目录或报告目录时，同步更新上述 VS Code 排除项，避免 IDE/扩展通过 `rg --files`、隐藏文件扫描或跟随符号链接把整个仓库打满 CPU。
- `search.followSymlinks` 默认保持为 `false`；除非任务明确需要跨符号链接搜索，否则不要改回跟随模式。
- 如果出现 VS Code 或系统整体卡顿，先检查工作区排除规则是否漂移，再怀疑语言服务、扩展或业务代码本身。
