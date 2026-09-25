# Windows 最后一次 PR 全量采集：部分证据

🔴 **不完整，未通过完整性能验收。** 本文根据原始 checkpoint 复算可用场景，不是 CI 生成的最终报告；原 artifact 没有 `report.json`，没有补造它。

- [运行 36128485027](https://github.com/weapp-vite/weapp-vite/actions/runs/36128485027)，Windows job `108050012955`；被测 HEAD `8f78b037289008bfefe38f43c8e42a7991a24dd6`，基线 `e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 2026-09-25 11:17:06 UTC 开始；六小时上限触发，17:17:37 采集取消，17:19:17 job 结束。artifact `10877352354` 上传成功；最终完整性检查因缺少 `report.json` 失败。
- 完整 artifact 和 job 日志已保全至后续 Issue 工作区。原始 [primary.json.gz](./ci-8f78-windows-primary.json.gz) 与 [confirmation.json.gz](./ci-8f78-windows-confirmation.json.gz) 无损提交；只含 CI 通用路径，不含本地私有路径。

## 采集覆盖

首批 148 个单侧记录：普通构建 7 对、classic 20 对、stateful 20 对、自动导入构建 7 对、自动导入 HMR 20 对均已结束。部分 HMR 场景因失败而缺值，不能把记录数当作有效样本数。

确认批 65 个单侧记录：classic 20 对完成；stateful 12 对完成，另保留第 13 对 baseline，optimized 采集中止。自动导入 HMR 确认未执行。普通及自动导入构建未触发确认，不是遗漏。

首批 22 条错误：20 条固定基线 classic Wevu sitemap，另有当前侧 stateful TDesign 第 3 对脚本更新/恢复协议超时，以及当前侧 Wevu 第 19 对脚本协议超时。确认批 20 条错误均为固定基线 classic sitemap。输出标记不能替代匹配的发布协议。

普通构建六项均有 7 对有效证据、首批未超过 5%；自动导入构建也已完成，不能将旧 ade120 的未完成自动导入数据代入本轮。相比旧采集，RSS 修正后的本轮进入了全部自动导入和 HMR 确认，但单个六小时任务仍不足以完成整个矩阵，这不是全量验收通过。

## 可用 checkpoint 的未通过场景

使用现有 `evaluateAuditGate` 从两份 checkpoint 复算，保留轮次唯一性和构建产物一致性检查。完整项仍按首批/唯一等量确认规则判定；缺项不缩小样本数。下表不能代替缺失的最终采集报告。

| 场景 | 首批 | 唯一确认 | 状态 |
| --- | ---: | ---: | --- |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | 🔴 +6.39% | 🔴 +0.09% | 🔴 unstable |
| `hmr:classic:weapp-vite-template:app-json:repeat:edit` | 🔴 +5.32% | 🔴 +3.37% | 🔴 unstable |
| `hmr:classic:weapp-vite-template:app-json:repeat:restore` | 🔴 +7.66% | 🔴 +4.75% | 🔴 unstable |
| `hmr:classic:weapp-vite-template:native-page-template:first:edit` | 🔴 +7.67% | 🔴 +2.77% | 🔴 unstable |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🔴 +6.14% | 🔴 +5.48% | 🔴 regression |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🔴 +6.76% | 🔴 +4.92% | 🔴 unstable |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | 🔴 +5.00% | 🔴 +3.67% | 🔴 unstable |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | 🔴 +8.52% | 🔴 +8.98% | 🔴 regression |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | 🔴 +12.12% | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | 🔴 +7.77% | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🔴 不可用 | 🔴 不可用 | 🔴 incomplete |
| `auto-hmr:20:manual:repeat:edit` | 🔴 +5.86% | 🔴 不可用 | 🔴 incomplete |

## 原始字节校验

- primary：5342033 字节；SHA-256 `a61b22c6ef0736f1ef5c9ec5c1c8ba4a2a78f27d21fc70ff44cc40f6681c77e7`。
- confirmation：760703 字节；SHA-256 `8b1194c25ce0eaa3159d3aafdd7c23f5dcad27ea6298bed0e3df9dc3c09602d0`。

## 合并后跟踪

PR #1076 已按维护者决定 squash 合并为 `d657d7b64bf2e5fb367862377255d513dab0ec07`。性能风险继续由 [#1082](https://github.com/weapp-vite/weapp-vite/issues/1082) 跟踪；首次 [Nightly 36172401898](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898) 使用 main 可信编排、三 OS × 九分片及固定批准基线，不重置本次历史确认。

此提交只归档证据，没有产品性能修复、公开 API 变化或 changeset。所有确认回退、不稳定、不可比较项继续保留。
