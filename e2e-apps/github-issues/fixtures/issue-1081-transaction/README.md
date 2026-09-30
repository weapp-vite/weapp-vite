# Issue #1081 事务验收

通过正常 `weapp-vite dev` 加载已发布的 Tailwind 依赖。fixture 的 pre-transform 插件仅用于设置可控的编译阻塞与错误，不替代 compiler provider 或 HMR transport。

- `BATCH_HOLD`：生成 `batch.entered` 诊断标志，等待 `batch.release`；期间连续保存新源码，验收旧页面不提前变更、恢复后文本与样式一致。
- `BATCH_FAIL`：使真实构建失败，确认不覆盖已有样式或更新脚本；修正源码后通过审计客户端确认批次消费，再检查配套样式。审计确认不作为真实宿主执行证明。
- CSS Modules：检查运行时类名与真实产物选择器对应，以及页面、App 和点击状态保持。

在仓库根目录运行：

```sh
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/issue-1081-batch-recovery.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1081-transaction.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1081-transaction.runtime.test.ts
```

以上命令必须串行。运行前重建受影响 package 的 dist；真实 DevTools 需要已登录且服务端口可用。suite 仅启动一次 automator，使用已登记的 `pages/index/index` 页面。

headless 不支持此场景所需的计算样式，所以只验证绑定、协议与生命周期；真实 DevTools 的背景色和文字颜色断言保持启用。mpcore 另有对应单测与浏览器计算样式测试，但不替代真实微信验收。
