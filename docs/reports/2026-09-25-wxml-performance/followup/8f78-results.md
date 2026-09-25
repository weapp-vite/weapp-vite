# 8f78b037 三平台门禁证据

🔴 **性能验收未完成**。本轮 Ubuntu 为 134 项 passed、3 项 regression、8 项 unstable、5 项 incomplete。macOS 已完成，另有 12 项确认回退、16 项不稳定及 12 项不完整，详见后文。Windows 仍在采集，不能推送打断它的唯一确认。

标记：🔴 未通过，优先于单批下降；🟢 已通过场景的耗时下降；阈值内的小幅增加保持中性。

- 固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 被测提交：`8f78b037289008bfefe38f43c8e42a7991a24dd6`。
- [Actions 运行 36128485027](https://github.com/weapp-vite/weapp-vite/actions/runs/36128485027)，Ubuntu job `108050012974`，于 2026-09-25 15:18:09 UTC 结束。
- artifact `10872436853` 完整下载；[原始顶层 JSON（gzip）](./ci-8f78-ubuntu.json.gz) 无损保存所有样本、失败、分段与功能启用成本，未改写状态或计时。
- 解压后 SHA-256：`f7c928172d55305e07b40ea623f05afa8cf09b26e62b5763ffea99ab9f90e289`。

## 门禁与完整性

150 个 manifest 指标均有门禁行。原生/TDesign 的 16 个 App JSON 阶段现各有 20 对样本，均 passed；旧 `window: {}` 导致的完全缺项已消除。普通构建 6 项各 7 对均 passed，最大增加 +1.49%。

四组自动导入覆盖基线/当前 × 手动/自动及 1/20/50/69 个组件；首批所有功能启用成本均未同时超过 25% 且 200 ms。这与跨提交 5% 门禁独立，不能抵消下列不稳定或回退。

首批保留 20 条采集错误，确认批保留 21 条。40 条来自固定基线 classic Wevu sitemap，另 1 条来自当前 stateful TDesign 脚本恢复。报告完整性检查据此失败，不是报告文件缺失。

## 🔴 全部未通过项目

构建每批 7 对，其余每批 20 对；只有一次等量确认。确认缺样本时不计算有利中位数。

| 指标 ID | 首批 | 唯一确认 | 状态 |
| --- | ---: | ---: | --- |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | 🔴 +5.36% | 🔴 -0.74% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | 🔴 +23.94% | 🔴 不完整或不可比较 | 🔴 incomplete |
| `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | 🔴 +5.42% | 🔴 -0.13% | 🔴 unstable |
| `hmr:classic:weapp-vite-template:native-page-template:first:edit` | 🔴 +6.26% | 🔴 +6.18% | 🔴 regression |
| `hmr:classic:weapp-vite-template:native-page-template:first:restore` | 🔴 +7.60% | 🔴 +7.32% | 🔴 regression |
| `hmr:classic:weapp-vite-template:native-page-style:first:edit` | 🔴 +5.25% | 🔴 -0.29% | 🔴 unstable |
| `hmr:classic:weapp-vite-template:native-page-style:first:restore` | 🔴 +7.43% | 🔴 +10.28% | 🔴 regression |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | 🔴 +23.17% | 🔴 +2.53% | 🔴 unstable |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | 🔴 不可用 | 🔴 不完整或不可比较 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | 🔴 不可用 | 🔴 不完整或不可比较 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | 🔴 不可用 | 🔴 不完整或不可比较 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🔴 不可用 | 🔴 不完整或不可比较 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | 🔴 +5.16% | 🔴 -0.50% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🔴 +21.04% | 🔴 +3.34% | 🔴 unstable |
| `auto-build:1:manual:repeat` | 🔴 +5.53% | 🔴 +0.44% | 🔴 unstable |
| `auto-hmr:20:automatic:first:restore` | 🔴 +20.43% | 🔴 +0.84% | 🔴 unstable |

stateful TDesign 脚本重复恢复首批为 +23.94%，确认第 4 对当前侧失败，缺少完整 20 对，不能标为回退已确认或通过。对应子报告 `confirmation/hmr-stateful-experimental-/3/optimized/report.json` 的 `diagnostics.phase` 为 `restore`：此前已发布版本 1/2/3，第二次恢复出现 `rebuilding → idle → request-error`，没有匹配的新 `batch-published`。源文件与输出已不含编辑标记，但不替代发布协议。dev 日志仍含临时保存文件 create/delete；只能关联既有分类问题，不能据此认定本次超时的完整因果链。

## 普通构建

| 指标 ID | 首批变化 | 每侧样本 |
| --- | ---: | ---: |
| `build:weapp-vite-tailwindcss-tdesign-template:first` | +0.50% | 7 |
| `build:weapp-vite-tailwindcss-tdesign-template:repeat` | +1.49% | 7 |
| `build:weapp-vite-template:first` | 🟢 -5.30% | 7 |
| `build:weapp-vite-template:repeat` | 🟢 -3.69% | 7 |
| `build:weapp-vite-wevu-template:first` | 🟢 -2.38% | 7 |
| `build:weapp-vite-wevu-template:repeat` | 🟢 -2.52% | 7 |

## 原生 classic 样式首次恢复分段

下表为各侧 20 个样本的中位数，单位 ms。端到端中位数与编译 profile 中位数的差不能直接归为某个函数成本；分段有包含关系，不能求和。

| 字段 | 首批基线 | 首批当前 | 确认基线 | 确认当前 |
| --- | ---: | ---: | ---: | ---: |
| `wallMs` | 357.590 | 384.165 | 360.030 | 397.049 |
| `totalMs` | 330.926 | 339.191 | 334.731 | 345.513 |
| `writeMs` | 8.911 | 9.283 | 9.137 | 9.421 |
| `entryLayoutMs` | 152.958 | 156.510 | 153.480 | 157.963 |
| `buildCoreMs` | 167.553 | 171.124 | 168.570 | 176.406 |
| `finalizePrepareMs` | 未记录 | 0.074 | 未记录 | 0.073 |
| `finalizeTemplateMs` | 未记录 | 0.034 | 未记录 | 0.035 |
| `finalizePublishMs` | 未记录 | 0.006 | 未记录 | 0.006 |
| `publicationValidateMs` | 未记录 | 0.020 | 未记录 | 0.020 |
| `publicationIndependentMs` | 未记录 | 0.004 | 未记录 | 0.004 |
| `publicationPruneMs` | 未记录 | 0.024 | 未记录 | 0.024 |

本轮 `writeMs` 增量仅 +0.371/+0.283 ms，没有重现 ade120 的约 +29/+28 ms 尾段增量。当前六段每段中位数均低于 0.1 ms；基线没有新增字段，不能填零或据此计算分段加速率。本证据不支持把本轮 +7.43%/+10.28% 的端到端回退归因于这六段，也不能证明旧回退已经修复。

后续应继续检查失效/编译路径及输入观察、产物确认和发布生命周期之间的时间关系，再在安全排期下用 CPU profile 定位。不能因为 25 ms 产物轮询粒度与部分增量接近，就缩短轮询、替换计时或豁免门禁。本轮未新增本地基准、watch 或 E2E，也未改产品源码。

## 15:28 UTC 交付记录（历史状态）

红绿报告标记、合入 main 的冲突修复及 PR #1076 固定基线保护已经本地提交；等待 Windows/macOS 原任务结束并保全证据后普通推送。报告基础设施 PR #1080 已获用户授权并合并到 main，合并提交 `6f5a830a0b959db6a9d9df0ddb5caa4ac6435ed9`；高权限报告仍只执行 main 的可信脚本。上述交付均不代表本 PR 性能通过。


## macOS：16:24 UTC 完成，🔴 未通过

macOS job `108050012976` 于 2026-09-25 16:24:10 UTC 结束；artifact `10874933935` 已完整保存。[原始顶层 JSON（gzip）](./ci-8f78-macos.json.gz) 无损保留 150 个门禁指标，结论为 110 passed、12 regression、16 unstable、12 incomplete。原始字节数 12828691，SHA-256：`0787c11cab8d9be9167d4332a67eeddc8d45e79c86778ee8934a27cef9d02959`。

构建每批 7 对，其余每批 20 对。下表逐项列出全部 40 个未通过指标；不稳定项目确认转负仍为失败，缺值不补零，也不另采一批覆盖本轮。

| 指标 ID | 首批变化 | 唯一确认 | 状态 |
| --- | ---: | ---: | --- |
| `build:weapp-vite-tailwindcss-tdesign-template:first` | 🔴 +5.48% | 🔴 -3.99% | 🔴 unstable |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | 🔴 +6.28% | 🔴 +4.03% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:classic:weapp-vite-template:app-json:first:edit` | 🔴 +6.42% | 🔴 +5.86% | 🔴 regression |
| `hmr:classic:weapp-vite-template:native-page-template:first:restore` | 🔴 +11.50% | 🔴 +10.27% | 🔴 regression |
| `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | 🔴 +13.01% | 🔴 +4.02% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | 🔴 +8.15% | 🔴 -0.55% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | 🔴 +6.54% | 🔴 -6.00% | 🔴 unstable |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | 🔴 +18.23% | 🔴 +11.00% | 🔴 regression |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🔴 +9.21% | 🔴 +9.94% | 🔴 regression |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🔴 不可用或不完整 | 🔴 不可用或不完整 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | 🔴 +9.30% | 🔴 -15.74% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🔴 +17.97% | 🔴 +8.01% | 🔴 regression |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🔴 +8.28% | 🔴 -9.47% | 🔴 unstable |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | 🔴 +13.30% | 🔴 -3.52% | 🔴 unstable |
| `auto-build:1:manual:first` | 🔴 +9.25% | 🔴 +6.76% | 🔴 regression |
| `auto-hmr:1:manual:repeat:edit` | 🔴 +5.29% | 🔴 -10.05% | 🔴 unstable |
| `auto-build:1:automatic:first` | 🔴 +13.81% | 🔴 +7.47% | 🔴 regression |
| `auto-build:1:automatic:repeat` | 🔴 +11.78% | 🔴 +6.51% | 🔴 regression |
| `auto-hmr:1:automatic:first:edit` | 🔴 +5.06% | 🔴 +5.62% | 🔴 regression |
| `auto-build:20:manual:first` | 🔴 +9.58% | 🔴 -8.11% | 🔴 unstable |
| `auto-hmr:20:manual:first:restore` | 🔴 +5.97% | 🔴 -4.70% | 🔴 unstable |
| `auto-hmr:20:manual:repeat:restore` | 🔴 +5.63% | 🔴 -5.15% | 🔴 unstable |
| `auto-hmr:20:automatic:repeat:restore` | 🔴 +11.52% | 🔴 -5.87% | 🔴 unstable |
| `auto-build:50:manual:repeat` | 🔴 +20.48% | 🔴 +5.35% | 🔴 regression |
| `auto-hmr:50:manual:repeat:restore` | 🔴 +18.80% | 🔴 +6.14% | 🔴 regression |
| `auto-build:50:automatic:first` | 🔴 +13.26% | 🔴 +1.42% | 🔴 unstable |
| `auto-hmr:50:automatic:first:edit` | 🔴 +7.16% | 🔴 +11.80% | 🔴 regression |
| `auto-hmr:50:automatic:first:restore` | 🔴 +13.54% | 🔴 -0.27% | 🔴 unstable |
| `auto-hmr:69:manual:first:restore` | 🔴 +12.06% | 🔴 -1.79% | 🔴 unstable |

首批 22 条错误、确认 20 条错误中，40 条仍是固定基线 classic Wevu sitemap 缺陷。另两条发生于首批当前侧：第 6 对 stateful TDesign 模板恢复未在超时前移除产物标记；第 7 对 stateful 原生脚本更新及恢复均未收到匹配的发布协议事件。这些场景没有完整有效的 20 对，因此相关四阶段均为 incomplete，不能拿其他有效阶段替代。

同提交自动导入 1/20/50/69 组件的启用成本均未同时超过 25% 且 200 ms；与表内跨提交回退保持独立。普通构建中 TDesign 首次构建 +5.48% / -3.99% 为 unstable，其余五项首批 passed。

当前 CI 迁移已本地提交 `3cfb908b7`：PR 改为 15 分钟上限的正确性冒烟，完整固定基线验收改为 Nightly 分片；后续提交 `80d5dd86c` 补强冻结身份、确认配置过滤和晚到冒烟报告；24 文件 115 项定向测试、核心编排依赖闭包 TypeScript、scoped ESLint 和 husky 通过。扩展检查既有 HMR 驱动依赖时仍有未修改 E2E 工具的历史类型错误，不称全量类型检查通过。本次没有产品修复或正式本地性能采样，所有上述失败继续保留。Windows 原任务结束并保全证据后才普通推送；Nightly 和高权限报告入口须进入 main 后方能进行 GitHub 实跑验证。
