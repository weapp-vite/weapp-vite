# 2026-06-15 Workspace HMR 全量报告

## 结论

本轮在 PR 分支 `codex/hmr-performance-guard` 上重建 `weapp-vite` 后，分别跑了全量 `templates/*` HMR benchmark 和全量 `e2e-apps/*` HMR audit。结果显示，默认 `sharedChunks: 'auto'` 下原先最危险的 shared chunk 扇出已经收敛：e2e-apps 全部 79 个场景通过，P95 为 `330.4ms`，最大值为 `408.7ms`；模板中大多数慢场景的 `pending/emitted` 已保持在 `1/1` 或 `2/2`。

剩余主要瓶颈不再是 `auto` 模式把稳定 shared chunk 扩散成几十个入口重建，而是 Tailwind、全局样式、模板写盘和 retail 模板的大体量输出成本。尤其 `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template` 的 `app-style` 仍为 `17845.9ms`，其中 write 阶段占 `11959.0ms`。

模板 benchmark 有 7 个场景等待 marker 超时，但 dev 进程没有崩溃，主要是 `app-script` marker 没有出现在 `dist/app.js`，另有一个 wevu + TDesign 模板的 `vue-app-json-macro` marker 未写入 `dist/app.json`。这些更像 benchmark 覆盖/marker 语义问题，不是本轮观察到的 HMR 崩溃或 shared chunk 扇出回归。

## 本轮命令

先同步下游验证需要的 CLI/runtime 产物：

```bash
pnpm --filter weapp-vite build
```

再运行全量模板 benchmark：

```bash
TEMPLATES_HMR_REPORT_DIR=.tmp/templates-hmr-all-pr-ab25dfec \
TEMPLATES_HMR_FAIL_ON_ERROR=0 \
TEMPLATES_HMR_STARTUP_TIMEOUT_MS=180000 \
TEMPLATES_HMR_TIMEOUT_MS=60000 \
TEMPLATES_HMR_BUDGET_MS=1000 \
pnpm benchmark:hmr:templates
```

再运行全量 e2e-apps audit：

```bash
WORKSPACE_HMR_MODE=nightly-full \
WORKSPACE_HMR_SCOPE=e2e-apps \
WORKSPACE_HMR_FAIL_ON_ERROR=0 \
WORKSPACE_HMR_STARTUP_TIMEOUT_MS=180000 \
WORKSPACE_HMR_TIMEOUT_MS=60000 \
WORKSPACE_HMR_MAX_STARTUP_MS=180000 \
WORKSPACE_HMR_MAX_SCENARIO_MS=1000 \
WORKSPACE_HMR_MAX_P95_MS=1000 \
WORKSPACE_HMR_REPORT_DIR=.tmp/e2e-apps-hmr-all-pr-ab25dfec \
pnpm exec tsx ./scripts/audit-workspace-hmr.ts
```

## Templates 汇总

| template | startup | measured/discovered | max profile | failures |
| --- | ---: | ---: | ---: | ---: |
| `templates/weapp-vite-lib-template` | 1214.3ms | 10/11 | 198.5ms | 1 |
| `templates/weapp-vite-plugin-template` | 606.9ms | 5/6 | 64.4ms | 1 |
| `templates/weapp-vite-tailwindcss-tdesign-template` | 1715.5ms | 7/8 | 2411.7ms | 1 |
| `templates/weapp-vite-tailwindcss-template` | 1717.4ms | 7/8 | 2090.5ms | 1 |
| `templates/weapp-vite-tailwindcss-vant-template` | 1616.9ms | 7/8 | 2475.1ms | 1 |
| `templates/weapp-vite-template` | 812.7ms | 7/8 | 110.2ms | 1 |
| `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template` | 28106.2ms | 6/7 | 17845.9ms | 0 |
| `templates/weapp-vite-wevu-tailwindcss-tdesign-template` | 1729.3ms | 6/7 | 2358.7ms | 1 |
| `templates/weapp-vite-wevu-template` | 910.3ms | 7/7 | 171.1ms | 0 |

总体：

- templates: 9
- scenarios: 62/69
- budget: `1000ms`
- max profile total: `17845.9ms`
- max observed wall: `17967.2ms`
- over-budget scenarios: 14/69
- failed templates: 0
- failed scenarios: 7

## Templates 慢场景

| template | scenario | total | wall | build | transform | write | pending/emitted |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `app-style` | 17845.9ms | 17967.2ms | 5873.8ms | 4.7ms | 11959.0ms | 2/2 |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `vue-app-json-macro` | 6727.6ms | 6834.0ms | 647.0ms | 5.1ms | 6070.4ms | 1/1 |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `vue-page-template` | 4037.9ms | 4204.8ms | 531.4ms | 418.7ms | 3480.9ms | 1/3 |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `vue-page-script` | 3116.3ms | 3294.0ms | 586.6ms | 1163.0ms | 2494.3ms | 1/1 |
| `weapp-vite-tailwindcss-vant-template` | `native-page-template` | 2475.1ms | 2578.1ms | 127.9ms | 0.1ms | 2340.5ms | 2/2 |
| `weapp-vite-tailwindcss-tdesign-template` | `native-page-template` | 2411.7ms | 2536.2ms | 115.0ms | 0.1ms | 2293.7ms | 2/2 |
| `weapp-vite-wevu-tailwindcss-tdesign-template` | `vue-page-template` | 2358.7ms | 2444.4ms | 213.8ms | 5.8ms | 2128.6ms | 1/1 |
| `weapp-vite-tailwindcss-template` | `native-page-template` | 2090.5ms | 2266.1ms | 126.2ms | 0.1ms | 1958.1ms | 2/2 |
| `weapp-vite-wevu-tailwindcss-tdesign-template` | `vue-page-script` | 1924.6ms | 2071.9ms | 216.8ms | 23.7ms | 1700.5ms | 1/1 |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `json-sitemap` | 1809.7ms | 1940.7ms | 550.5ms | 7.4ms | 1219.6ms | 1/1 |
| `weapp-vite-tailwindcss-vant-template` | `native-page-script` | 1736.9ms | 1873.7ms | 180.1ms | 1.0ms | 1555.9ms | 1/1 |
| `weapp-vite-tailwindcss-tdesign-template` | `native-page-script` | 1714.0ms | 1851.6ms | 178.2ms | 1.2ms | 1534.9ms | 1/1 |
| `weapp-vite-tailwindcss-template` | `native-page-script` | 1671.6ms | 1774.7ms | 183.8ms | 1.2ms | 1487.1ms | 1/1 |
| `weapp-vite-wevu-tailwindcss-tdesign-retail-template` | `vue-page-json-macro` | 1562.4ms | 1732.6ms | 488.6ms | 5.5ms | 1062.2ms | 2/2 |

这些慢场景的共同点是 write 阶段占比很高，并且 `pending/emitted` 没有回到优化前的几十入口扇出。也就是说，`auto` shared chunk 策略本身已经不会把页面级保存扩大成全量 shared refresh；后续要继续压低耗时，应优先拆解 Tailwind 生成、全局 CSS 输出、SFC template/script 到小程序文件的写入链路。

## Template 失败场景说明

失败场景明细：

- `weapp-vite-lib-template / app-script`
- `weapp-vite-plugin-template / app-script`
- `weapp-vite-tailwindcss-tdesign-template / app-script`
- `weapp-vite-tailwindcss-template / app-script`
- `weapp-vite-tailwindcss-vant-template / app-script`
- `weapp-vite-template / app-script`
- `weapp-vite-wevu-tailwindcss-tdesign-template / vue-app-json-macro`

其中 6 个 `app-script` 失败都是等待插入 marker 出现在 `dist/app.js` 超时。`weapp-vite-wevu-tailwindcss-tdesign-template / vue-app-json-macro` 是等待 `dist/app.json` marker 超时。需要单独修 benchmark marker 策略，避免把“不应该落入目标产物的 marker”误报为 HMR 失败。

## e2e-apps 汇总

| metric | result |
| --- | ---: |
| projects | 28 |
| scenarios | 79/79 |
| failed projects | 0 |
| scenario P50 | 150.1ms |
| scenario P95 | 330.4ms |
| scenario max | 408.7ms |
| threshold issues | 0 |

e2e-apps 的结果比较稳定，全部场景通过，没有超过 `1000ms` 的场景。Top 慢场景也都是 `pending/emitted = 1/1`，没有 broad shared chunk fanout。

## e2e-apps 慢场景

| project | scenario | total | observed | build | transform | write | pending/emitted |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `e2e-apps/request-clients-real` | `vue-style` | 408.7ms | 768.3ms | 406.1ms | 30.9ms | 1.0ms | 1/1 |
| `e2e-apps/request-clients-real` | `vue-template` | 384.6ms | 766.7ms | 381.6ms | 32.2ms | 0.9ms | 1/1 |
| `e2e-apps/request-clients-real` | `vue-script` | 383.4ms | 767.8ms | 381.3ms | 31.9ms | 0.8ms | 1/1 |
| `e2e-apps/template-wevu-tdesign-regression` | `vue-template` | 330.4ms | 783.1ms | 234.1ms | 21.1ms | 95.2ms | 1/1 |
| `e2e-apps/template-wevu-tdesign-regression` | `vue-script` | 277.3ms | 779.3ms | 180.1ms | 20.7ms | 96.2ms | 1/1 |
| `e2e-apps/wevu-subpackage-placement` | `vue-template` | 268.7ms | 769.3ms | 262.8ms | 64.1ms | 0.9ms | 1/1 |
| `e2e-apps/wevu-subpackage-placement` | `vue-style` | 259.1ms | 767.4ms | 253.2ms | 63.7ms | 0.9ms | 1/1 |
| `e2e-apps/wevu-subpackage-placement` | `vue-script` | 245.5ms | 768.9ms | 242.6ms | 177.2ms | 1.0ms | 1/1 |
| `e2e-apps/request-clients-real-native` | `native-script` | 219.5ms | 765.0ms | 215.8ms | 1.8ms | 0.7ms | 1/1 |
| `e2e-apps/request-clients-real-native` | `native-template` | 212.9ms | 767.2ms | 209.4ms | 0.5ms | 0.7ms | 1/1 |

## e2e-apps 启动耗时

| project | startup | scenarios |
| --- | ---: | ---: |
| `e2e-apps/issue-814-tailwind3` | 7804.3ms | 2 |
| `e2e-apps/template-wevu-tdesign-regression` | 4153.1ms | 2 |
| `e2e-apps/request-clients-real` | 3321.3ms | 3 |
| `e2e-apps/wevu-features` | 2905.3ms | 3 |
| `e2e-apps/wevu-runtime-e2e` | 2622.4ms | 6 |
| `e2e-apps/request-clients-real-native` | 2547.1ms | 3 |
| `e2e-apps/issue-814-tailwind4-broken` | 2533.4ms | 2 |
| `e2e-apps/issue-814-tailwind4` | 2525.5ms | 2 |

## 下一步优化目标

1. 优先拆 `retail / app-style`：当前总耗时 `17845.9ms`，write `11959.0ms`，build `5873.8ms`。这是全量模板中最明确的剩余瓶颈。
2. 拆 `retail / vue-app-json-macro` 和 `retail / vue-page-template`：两者 write 分别为 `6070.4ms`、`3480.9ms`，说明 JSON/template 输出路径还有较大的写盘空间。
3. 拆 Tailwind 原生模板的 `native-page-template` 和 `native-page-script`：`tailwindcss-template`、`tailwindcss-tdesign-template`、`tailwindcss-vant-template` 都集中在 `1.6s` 到 `2.5s`。
4. 单独修 benchmark marker 语义：把 `app-script` 和 `vue-app-json-macro` 的 marker 期待改成真正稳定的产物语义校验，避免以后全量报告被覆盖工具误报污染。
5. 继续保留现有 HMR fanout 守卫和内存守卫：当前 e2e-apps P95 已在 `330.4ms`，说明默认 `auto` 的核心路径可以持续用 CI 守住。
