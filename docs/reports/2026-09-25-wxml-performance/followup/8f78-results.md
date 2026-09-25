# 8f78b037 Ubuntu 门禁证据

🔴 **性能验收未完成**。本轮 Ubuntu 为 134 项 passed、3 项 regression、8 项 unstable、5 项 incomplete。Windows 和 macOS 在本记录整理时仍在采集，不能推送打断它们的唯一确认。

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

## 后续交付状态

红绿报告标记、合入 main 的冲突修复及 PR #1076 固定基线保护已经本地提交；等待 Windows/macOS 原任务结束并保全证据后普通推送。报告基础设施 PR #1080 已获用户授权并合并到 main，合并提交 `6f5a830a0b959db6a9d9df0ddb5caa4ac6435ed9`；高权限报告仍只执行 main 的可信脚本。上述交付均不代表本 PR 性能通过。
