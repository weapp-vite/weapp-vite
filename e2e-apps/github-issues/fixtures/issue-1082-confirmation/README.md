# Stateful HMR 执行确认回归

本场景覆盖 #1082 排查中发现的协议缺陷，不代表完整性能验收。

- 关闭微信 IDE 的 `compileHotReLoad`，让真实宿主重编译并更换客户端会话。
- 使用正常 CLI 和实际输出文件，连续修改业务模块为 first、second、restored，检查页面文字和最终按钮事件。
- headless 使用同一 runtime suite 验证补丁交付与渲染；宿主重编译造成的会话切换由真实 DevTools 和 transport 定向测试共同覆盖。
- transport 定向测试另行稳定复现：更新文件已可执行，但发布流程尚未结束时，客户端提前上报执行结果。

开发基线为 `e29dee8a5fbd4eda4048c6c2f87a62937af8a4d0`。本轮使用 Node 24.18.0、pnpm 12.6.0、WeChat DevTools 2.02.2609231、基础库 3.17.2。

```sh
pnpm --filter weapp-vite build
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/issue-1082-confirmation.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1082-confirmation.runtime.test.ts
```

两种 provider 必须串行执行。本轮各通过 1 个 runtime 场景，三个文字检查点均通过，warning/error/exception 均为 0。完整的三系统性能门禁尚未完成，issue 保持 open。
