# ade120 Ubuntu / macOS 门禁证据

性能验收未完成。Ubuntu 和 macOS 均为 `regression`；不能将既有基线缺陷作为唯一阻塞，也不能用整体平均数覆盖确认回退。Windows 在本记录整理时仍运行，其本轮结果尚未纳入。

- 固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 被测提交：`ade120b76e7809198444aacabdac766861334f30`。
- [Actions 运行 36096791457](https://github.com/weapp-vite/weapp-vite/actions/runs/36096791457)。
- Ubuntu job `107950927651`；macOS job `107950927807`。
- 普通/自动导入构建每批 7 对；HMR 每批 20 对。超过 5% 只进行一次等量确认；结论冲突仍失败。

## 原始报告与完整性

下列 gzip 文件无损保存 artifact 顶层 `report.json` 的原始字节，未删除失败、重算历史状态或修改时间。报告包含逐轮时间、内存、编译分段、产物摘要、首批/确认批次、错误及四组自动导入启用成本。gzip 解压后的 SHA-256 如下。逐轮子报告、失败产物和日志保留于 Actions artifact。

| 平台 | 原始报告 | SHA-256 |
| --- | --- | --- |
| ubuntu | [完整 JSON（gzip）](./ci-ade-ubuntu.json.gz) | `f3fb96431fec46ebac8571d9e5447f322085b1bd6b496629b845e039943db96a` |
| macos | [完整 JSON（gzip）](./ci-ade-macos.json.gz) | `3a1ca879ccff1145e76c53aa2e767e986929b1fd3cadc02b13e57eae7adaff9b` |

| 平台 | passed | regression | unstable | incomplete |
| --- | ---: | ---: | ---: | ---: |
| ubuntu | 116 | 5 | 1 | 12 |
| macos | 84 | 12 | 29 | 9 |

上述是原始表格计数。两平台各有 16 个原生/TDesign App JSON 阶段完全缺样本，旧渲染器未把它们列为单独行，但 manifest 错误已阻止总门禁通过。不得把缺行当成通过。待推送的工具修正会显式列出全部缺项，且支持向现有 `window: {}` 添加合法标题；本报告不回填这些缺失时间。

自动导入的实际组件数量为 1/20/50/69，均包含基线/当前 × 手动/自动四组。两平台首批启用成本表中没有同时超过 25% 且 200 ms 的项目；这不抵消 main/PR 同配置比较的回退。

## 确认回退

每行两批均超过 5%。数值为各侧中位数的相对变化；P95、成对差值及原始轮次见完整 JSON。

### ubuntu

| 指标 ID | 首批 | 唯一确认 | 每批对数 |
| --- | ---: | ---: | ---: |
| `hmr:classic:weapp-vite-template:native-page-script:first:edit` | +5.06% | +6.72% | 20 |
| `hmr:classic:weapp-vite-template:native-page-style:first:restore` | +8.42% | +5.99% | 20 |
| `auto-hmr:20:automatic:repeat:edit` | +15.31% | +9.11% | 20 |
| `auto-hmr:50:automatic:first:restore` | +15.48% | +17.42% | 20 |
| `auto-hmr:69:manual:first:restore` | +16.75% | +8.80% | 20 |

### macos

| 指标 ID | 首批 | 唯一确认 | 每批对数 |
| --- | ---: | ---: | ---: |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | +6.28% | +6.41% | 20 |
| `hmr:classic:weapp-vite-template:native-page-script:first:restore` | +11.05% | +11.18% | 20 |
| `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | +5.38% | +13.98% | 20 |
| `hmr:classic:weapp-vite-template:native-page-style:first:restore` | +25.53% | +9.54% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | +8.78% | +9.50% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | +17.92% | +6.06% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | +12.10% | +13.58% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | +15.68% | +9.92% | 20 |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | +8.59% | +6.55% | 20 |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | +5.63% | +20.17% | 20 |
| `auto-build:69:manual:first` | +30.97% | +6.55% | 7 |
| `auto-hmr:20:automatic:first:edit` | +6.78% | +5.53% | 20 |

## 不稳定项目

Ubuntu 1 项，macOS 29 项；按既定规则均不能通过，未执行第二次确认。

| 平台 / 指标 ID | 首批 | 唯一确认 |
| --- | ---: | ---: |
| ubuntu / `auto-hmr:1:manual:first:restore` | +18.79% | +1.73% |
| macos / `build:weapp-vite-template:first` | +11.29% | -6.00% |
| macos / `build:weapp-vite-template:repeat` | +13.61% | -8.83% |
| macos / `build:weapp-vite-wevu-template:first` | +6.75% | -11.62% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | +8.47% | -8.82% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | +9.03% | +1.89% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | +6.93% | -9.19% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | +5.59% | -1.25% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | +6.53% | -1.93% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | +13.70% | +0.15% |
| macos / `hmr:classic:weapp-vite-template:native-page-template:first:restore` | +8.21% | -0.91% |
| macos / `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | +12.60% | -0.54% |
| macos / `hmr:classic:weapp-vite-template:native-page-style:first:edit` | +13.39% | -2.68% |
| macos / `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | +6.28% | -0.24% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | +15.56% | +3.18% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | +6.59% | -5.89% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | +8.01% | +4.64% |
| macos / `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | +5.99% | -4.47% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | +14.07% | -2.70% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | +7.01% | +0.27% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | +5.20% | +0.86% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | +6.25% | -6.16% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | +6.40% | -14.17% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | +13.76% | +1.93% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | +7.88% | +3.35% |
| macos / `auto-build:1:manual:repeat` | +8.38% | +4.26% |
| macos / `auto-build:20:automatic:repeat` | +6.28% | +2.07% |
| macos / `auto-build:50:automatic:first` | +9.39% | +4.92% |
| macos / `auto-build:50:automatic:repeat` | +9.55% | +1.21% |
| macos / `auto-hmr:20:automatic:repeat:restore` | +21.00% | -0.85% |

## 失败与根因边界

- 两平台固定基线 Wevu `json-sitemap` 的历史依赖缺陷仍保留，未修改基线、删除场景或填造时间。
- Ubuntu 首批第 12 对：当前 Wevu 和基线 TDesign 脚本发布协议超时；当前 Wevu 恢复也失败。
- macOS 首批第 1 对：双方 TDesign 脚本发布协议超时；确认第 20 对：基线 Wevu 脚本编辑/恢复发布协议超时。输出含标记不能替代匹配的 `batch-published`。
- 上述 macOS 失败会话也记录了临时保存文件 create/delete。mock session 测试已确定性证明混合临时文件与有效脚本 Patch 会触发一次 snapshot rebuild 和一次 full engine rebuild，而不是交付第二个 delta。该测试证明分类行为，不证明 CI 超时因果链，更不能解释所有 classic 性能回退。
- 常规侧车 watcher 已按侧车类型筛选。不能靠屏蔽某个临时文件名或全部 dotfiles 修复；自定义 compiler、用户 `addWatchFile`、WXML 依赖、copy/public 和目录拓扑仍须保留。当前原生引擎公开 API 缺少监听依赖查询，后续需在实际所有权边界建立可验证事实。

## 编译分段诊断

原生 classic 样式首次恢复是两个平台共同的确认回退。下表为当前减基线的分段中位数差值（ms），分段有包含/重叠关系，不能直接求和。

| 平台 / 批次 | 端到端 | compiler total | writeMs | entryLayoutMs | buildCoreMs |
| --- | ---: | ---: | ---: | ---: |
| Ubuntu / 首批 | +51.76 | +44.85 | +29.01 | +9.30 | +14.30 |
| Ubuntu / 确认 | +36.90 | +47.76 | +28.03 | +11.44 | +10.37 |
| macOS / 首批 | +122.03 | +120.92 | +34.81 | +42.65 | +24.84 |
| macOS / 确认 | +52.97 | +14.46 | +38.11 | +16.23 | −9.12 |

`writeMs` 从普通 `generateBundle` 到 `writeBundle` 收尾，包含 post finalizer/publication 成本，不是纯 I/O。两平台持续增加只能缩小下一次 CPU profile 的调查范围，尚无证据认定 WXML 扫描或某个函数是根因。本轮没有在竞争负载下启动本地正式基准或 E2E，也没有重跑未修改的采样求绿。
