# HMR Guard Suite

这组测试用于保护 `weapp-vite` 的开发态热更新体验，重点关注“编辑后是否正确更新”和“更新范围是否异常放大”。

## 入口

全量 HMR 护栏：

```bash
pnpm run e2e:hmr:guard
```

本地快速 smoke：

```bash
pnpm run e2e:hmr:guard:smoke
```

查看分组包含了哪些文件：

```bash
pnpm run e2e:hmr:guard:config
```

这个命令会打印 suite manifest，而不是直接执行测试。

## 覆盖范围

- `e2e/ci/hmr-modify.test.ts`
  验证页面与组件在模板、脚本、样式、JSON、SFC 修改后的输出更新。
- `e2e/ci/hmr-layouts.test.ts`
  验证 layouts 页面及 `src/layouts/default|admin` 在模板、脚本、样式、JSON 修改后的输出更新。
- `e2e/ci/hmr-rename.test.ts`
  验证编辑器常见 rename-save 流程不会打挂 dev 过程。
- `e2e/ci/hmr-shared-runtime-deps.test.ts`
  验证共享运行时脚本在 rename-save 与连续快速保存后，`common.js` 及多个 importer 仍保持一致，不会出现共享导出丢失。
- `e2e/ci/hmr-rapid.test.ts`
  验证连续快速保存后最终产物收敛到最后一次修改。
- `e2e/ci/hmr-add.test.ts`
  验证新增页面/组件文件时 dev 过程稳定。
- `e2e/ci/hmr-delete.test.ts`
  验证删除页面/组件文件时 dev 过程稳定。
- `e2e/ci/hmr-app-config.test.ts`
  验证 `app.json` 的 window/pages 更新能在 dev 下生效。
- `e2e/ci/auto-routes-hmr.test.ts`
  验证 auto-routes 在 dev 下维护 `typed-router`、`app.json`、`app.js`，并对已有页面修改保持增量更新。
- `e2e/ci/auto-import-vue-sfc.test.ts`
  验证 auto-import 维护 `usingComponents`，并对单页改动保持增量更新。
- `e2e/ci/hmr-shared-chunks-auto.test.ts`
  验证 `hmr.sharedChunks = 'auto'` 下的直接 entry 更新与共享依赖扩散路径。
- `e2e/ci/wevu-runtime.hmr.test.ts`
  验证 wevu 运行时 HMR 的页面级行为。

## 分组策略

- `e2e:hmr:guard`
  串行执行稳定子集：`hmr-modify`、`hmr-layouts`、`hmr-rename`、`hmr-shared-runtime-deps`、`hmr-rapid`、`hmr-add`、`hmr-delete`、`hmr-app-config`、`auto-import-vue-sfc`、`auto-routes-hmr`、`wevu-runtime.hmr`。
- `e2e:hmr:guard:smoke`
  串行执行本地高频回归子集：`auto-import-vue-sfc`、`auto-routes-hmr`、`hmr-rename`、`hmr-rapid`。
- `e2e:hmr:guard:shared-chunks-auto`
  单独执行 `hmr-shared-chunks-auto`。这个用例对命令入口和进程清理顺序更敏感，不并入主串行 suite。
- `e2e/vitest.e2e.hmr-guard.config.ts`
  保留完整 include 清单，便于查看和按需单独调用，但不建议直接把整组 dev-watch 用例塞进同一个 Vitest 进程运行。

## 运行建议

- 改动 `packages/weapp-vite/src/plugins/core/**`、`packages/weapp-vite/src/plugins/hooks/useLoadEntry/**`、`packages/weapp-vite/src/plugins/autoRoutes.ts`、auto-import 或 watcher 相关逻辑后，至少运行 `pnpm run e2e:hmr:guard:smoke`。
- 如果改动涉及 dev watch、HMR 发射范围、共享 chunk、`usingComponents`、路由生成或 `app.json` 同步，运行 `pnpm run e2e:hmr:guard`。
- 若先修改了 `packages/weapp-vite/src/**`，在跑 app/template/e2e 之前先执行：

```bash
pnpm --filter weapp-vite build
```

## 维护原则

- 对结构性变更场景，优先验证“最终行为正确”和“dev 过程不崩”。
- 对单页直接编辑场景，优先补日志级断言，防止退化成全量 HMR。
- 新增 HMR 回归时，先决定它属于稳定子集、smoke 子集，还是像 `shared-chunks-auto` 一样必须作为特例独立运行；然后更新 `e2e/scripts/hmr-guard-manifest.ts`，让入口、清单和文档保持同源。
- `e2e:hmr:guard` 与 `e2e:hmr:guard:smoke` 由 `e2e/scripts/run-hmr-guard-suite.ts` 统一驱动，采用“单文件 `vitest run` 串行 + 每段前显式 cleanup”的方式执行；不要把整组 HMR dev-watch 用例直接塞进同一个 Vitest 进程，否则不同文件的清理逻辑容易互相污染。
