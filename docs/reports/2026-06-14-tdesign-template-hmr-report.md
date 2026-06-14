# 2026-06-14 TDesign Wevu 模板 HMR 报告

## 结论

本次先针对两个较重的 wevu + TDesign 模板建立守卫测试，并优化 weapp-vite 默认 `auto` 模式下的 HMR 入口收敛逻辑。调整后，保存 Vue SFC 模板时的 HMR 影响面已从多入口扇出收敛到单入口更新，不需要在模板里配置 `sharedChunks: 'off'`。

第二轮继续收窄 sidecar snapshot build：只有无法定位到单入口的旁路拓扑变化才强制 full shared chunk refresh；普通 `.wxml`、`.wxss`、`.json` 窄入口更新保持默认 `auto` 逻辑。retail 模板的 `app-style` 采样从前序约 `25855.4ms` 降到 `17574.1ms`，主要收益来自减少 sidecar 更新时不必要的 shared chunk 图刷新。

CI 已有 `Workspace HMR Changed Projects` 和 `Workspace HMR Nightly Full` 两个任务生成 `.tmp/workspace-hmr/**` 报告 artifact；本地可通过 `pnpm audit:hmr:*` 生成同格式报告。

## 本次验证命令

```bash
pnpm vitest run packages/weapp-vite/src/plugins/hooks/useLoadEntry/index.test.ts packages/weapp-vite/src/runtime/buildPlugin/service.test.ts packages/weapp-vite/src/plugins/core/lifecycle/emit.more.test.ts scripts/workspace-hmr/baseline.test.ts packages/weapp-vite/src/plugins/core.test.ts packages/weapp-vite/src/plugins/core/helpers/graph.test.ts
```

结果：6 个测试文件通过，159 个测试用例通过。

```bash
pnpm vitest run --pool forks -c ./e2e/vitest.e2e.ci.config.ts e2e/ci/hmr-shared-chunks-auto.test.ts
```

结果：1 个测试文件通过，2 个测试用例通过。

```bash
pnpm vitest run --pool forks -c ./e2e/vitest.e2e.ci.config.ts e2e/ci/e2e-app-tailwind-memory-guard.test.ts
```

结果：1 个测试文件通过，3 个测试用例通过。GC 后 heap 增长分别为 `29.1 MiB`、`27.8 MiB`、`53.1 MiB`，均低于 `180.0 MiB` 阈值。

```bash
WORKSPACE_HMR_MODE=smoke \
WORKSPACE_HMR_SCOPE=templates \
WORKSPACE_HMR_FILTER=weapp-vite-wevu-tailwindcss-tdesign \
WORKSPACE_HMR_REPORT_DIR=.tmp/workspace-hmr-tdesign-auto \
WORKSPACE_HMR_FAIL_ON_ERROR=1 \
WORKSPACE_HMR_MAX_STARTUP_MS=60000 \
pnpm exec tsx ./scripts/audit-workspace-hmr.ts
```

结果文件：

- `.tmp/workspace-hmr-tdesign-auto/report.md`
- `.tmp/workspace-hmr-tdesign-auto/report.json`
- `.tmp/workspace-hmr-tdesign-auto/thresholds.md`

```bash
WORKSPACE_HMR_MODE=changed-project \
WORKSPACE_HMR_SCOPE=workspace \
WORKSPACE_HMR_FAIL_ON_ERROR=1 \
WORKSPACE_HMR_STARTUP_TIMEOUT_MS=180000 \
WORKSPACE_HMR_TIMEOUT_MS=60000 \
WORKSPACE_HMR_MAX_STARTUP_MS=180000 \
WORKSPACE_HMR_MAX_SCENARIO_MS=1000 \
WORKSPACE_HMR_MAX_P95_MS=1000 \
WORKSPACE_HMR_MAX_REGRESSION_MS=12000 \
WORKSPACE_HMR_MAX_PENDING_COUNT=16 \
WORKSPACE_HMR_MAX_EMITTED_COUNT=16 \
WORKSPACE_HMR_MAX_PENDING_DELTA=8 \
WORKSPACE_HMR_MAX_EMITTED_DELTA=8 \
WORKSPACE_HMR_REPORT_DIR=.tmp/workspace-hmr-ci-final \
pnpm exec tsx ./scripts/audit-workspace-hmr.ts
```

结果：changed-project fallback smoke 通过。

## Smoke 结果

| project | scenario | total | observed | build | write | pending/emitted | impact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `vue-template` | 1962.8ms | 2289.4ms | 860.8ms | 1089.2ms | 1 / 1 | `pages/category/index.wxml` |
| `templates/weapp-vite-wevu-tailwindcss-tdesign-template` | `vue-template` | 516.0ms | 1012.5ms | 313.6ms | 187.5ms | 1 / 1 | `pages/index/index.wxml` |

Threshold 结果：

- measured scenarios: 2/2
- scenario P95: 1962.8ms
- threshold issues: 0

## 对比基线

优化前采样中，retail 模板 `vue-page-script` 曾出现 `pending/emitted = 75 / 75`，总耗时约 19817.6ms，pending 原因包含 `shared-chunk(common.js,wevu-ref.js+)+74:direct`。

当前 smoke 报告中两个模板均为 `pending/emitted = 1 / 1`，说明默认 `auto` 模式下，页面级 Vue SFC 模板更新不再因为稳定公共 chunk importer 扇出而触发大量入口重建。

## 剩余瓶颈

retail 模板首轮启动仍偏慢：

- startup: 29080.9ms

前序详细 benchmark 采样到 retail 模板仍存在非 shared chunk 扇出瓶颈：

| scenario | total |
| --- | ---: |
| `vue-app-json-macro` | 10022.4ms |
| `vue-page-json-macro` | 1673.4ms |
| `vue-page-template` | 3387.5ms |
| `vue-page-script` | 3946.0ms |
| `app-style` | 25855.4ms |
| `json-sitemap` | 2003.7ms |

第二轮 sidecar 优化后，retail 模板局部采样结果：

| scenario | total | build-core | transform | write | pending/emitted |
| --- | ---: | ---: | ---: | ---: | ---: |
| `vue-app-json-macro` | 6691.8ms | 674.1ms | 5.2ms | 6004.6ms | 1 / 1 |
| `vue-page-json-macro` | 1623.5ms | 504.9ms | 5.4ms | 1108.1ms | 2 / 2 |
| `vue-page-template` | 3771.3ms | 543.6ms | 1067.2ms | 3203.2ms | 1 / 3 |
| `vue-page-script` | 3193.4ms | 665.0ms | 605.5ms | 2514.8ms | 1 / 1 |
| `app-style` | 17574.1ms | 5939.1ms | 6.2ms | 11615.1ms | 2 / 2 |

其中 `app-style` 仍然是全局样式、Tailwind `@source` 扫描和写盘链路成本，不能通过关闭 shared chunk 或手写产物规避。当前优化只收敛 weapp-vite 自身不必要的 shared refresh，剩余瓶颈需要继续拆解 Tailwind 生成和 Rolldown write 阶段。

## 守卫覆盖

- `packages/weapp-vite/src/plugins/hooks/useLoadEntry/index.test.ts`：锁定默认 `auto` 模式下，即使稳定 vendor shared chunk 有 75 个 importer，直接入口更新也只重建当前 dirty 入口。
- `packages/weapp-vite/src/runtime/buildPlugin/service.test.ts`：锁定窄 sidecar snapshot build 不再强制 full shared chunk refresh，同时保留拓扑变化的 full fallback。
- `scripts/workspace-hmr/baseline.test.ts`：锁定模板 HMR 扇出超过优化预算时会快速报错，避免 `75 / 75` 这类结果静默通过。
- `scripts/workspace-hmr/templates-baseline.json`：更新 `templates/weapp-vite-lib-template` 的 `native-script` 稳定 impact 基线，并将该场景增量 impact 预算设为 0，避免 changed-project smoke 因旧基线误报，也避免新增写盘文件静默通过。

## 后续建议

下一步建议继续拆分 retail 模板的 Tailwind 全局样式生成、Rolldown write 阶段和首轮启动阶段。当前默认 `auto` 模式下，页面 Vue SFC 保存和窄 sidecar 更新的共享 chunk 扇出已经收敛，但全局样式写盘仍然是主要耗时来源。
