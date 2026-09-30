# Issue #1072：JSON 合并上下文

使用正常 CLI 构建三个页面，验证合并策略读取编译器已经解析的 `routeConfig` 和 `pageMeta`：

- home：内联脚本及导入别名，最终标题为 `home:static`。
- external：外部 script setup，最终标题为 `external:static`。
- dynamic：对象含动态值，整个 `pageMeta` 为 undefined，最终标题为 `dynamic:dynamic`。

构建测试检查最终 JSON 和 JS/WXML 文件，并通过 dev CLI 修改、恢复 `definePageJson`，确认 JSON-only HMR 保留元数据。runtime suite 共用一次 automator，依次 reLaunch 三页，验证计数从 0 更新到 1；两种 provider 使用同一断言。

```sh
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/issue-1072-json-context.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1072-json-context.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1072-json-context.runtime.test.ts
```

运行下游验证前需要依次构建 `@wevu/compiler`、`wevu`、`weapp-vite`。所有 E2E 全局串行。构建/DOM 验收不把宿主标题栏 UI 作为页面 DOM 节点；标题值通过最终 JSON 断言。
