# ade120 Ubuntu / macOS 门禁证据

标记：🔴 未通过或单批越过 5%（是否确认回退以文字结论为准）；🟢 本批耗时下降；阈值内的小幅增加保持中性。未通过项目优先标红，即使其中一次复核变快；绿色数值不代表整个 PR 通过验收。

🔴 **性能验收未完成。**Ubuntu 和 macOS 均为 `regression`；不能将既有基线缺陷作为唯一阻塞，也不能用整体平均数覆盖确认回退。Windows 在本记录整理时仍运行，其本轮结果尚未纳入。

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

| 平台 | passed | 🔴 regression | 🔴 unstable | 🔴 incomplete |
| --- | ---: | ---: | ---: | ---: |
| ubuntu | 116 | 5 | 1 | 12 |
| macos | 84 | 12 | 29 | 9 |

上述是原始表格计数。两平台各有 16 个原生/TDesign App JSON 阶段完全缺样本，旧渲染器未把它们列为单独行，但 manifest 错误已阻止总门禁通过。不得把缺行当成通过。待推送的工具修正会显式列出全部缺项，且支持向现有 `window: {}` 添加合法标题；本报告不回填这些缺失时间。

自动导入的实际组件数量为 1/20/50/69，均包含基线/当前 × 手动/自动四组。两平台首批启用成本表中没有同时超过 25% 且 200 ms 的项目；这不抵消 main/PR 同配置比较的回退。

## 🔴 确认回退

每行两批均超过 5%。数值为各侧中位数的相对变化；P95、成对差值及原始轮次见完整 JSON。

### ubuntu

| 指标 ID | 首批 | 唯一确认 | 每批对数 |
| --- | ---: | ---: | ---: |
| `hmr:classic:weapp-vite-template:native-page-script:first:edit` | 🔴 +5.06% | 🔴 +6.72% | 20 |
| `hmr:classic:weapp-vite-template:native-page-style:first:restore` | 🔴 +8.42% | 🔴 +5.99% | 20 |
| `auto-hmr:20:automatic:repeat:edit` | 🔴 +15.31% | 🔴 +9.11% | 20 |
| `auto-hmr:50:automatic:first:restore` | 🔴 +15.48% | 🔴 +17.42% | 20 |
| `auto-hmr:69:manual:first:restore` | 🔴 +16.75% | 🔴 +8.80% | 20 |

### macos

| 指标 ID | 首批 | 唯一确认 | 每批对数 |
| --- | ---: | ---: | ---: |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | 🔴 +6.28% | 🔴 +6.41% | 20 |
| `hmr:classic:weapp-vite-template:native-page-script:first:restore` | 🔴 +11.05% | 🔴 +11.18% | 20 |
| `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | 🔴 +5.38% | 🔴 +13.98% | 20 |
| `hmr:classic:weapp-vite-template:native-page-style:first:restore` | 🔴 +25.53% | 🔴 +9.54% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | 🔴 +8.78% | 🔴 +9.50% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🔴 +17.92% | 🔴 +6.06% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🔴 +12.10% | 🔴 +13.58% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | 🔴 +15.68% | 🔴 +9.92% | 20 |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | 🔴 +8.59% | 🔴 +6.55% | 20 |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | 🔴 +5.63% | 🔴 +20.17% | 20 |
| `auto-build:69:manual:first` | 🔴 +30.97% | 🔴 +6.55% | 7 |
| `auto-hmr:20:automatic:first:edit` | 🔴 +6.78% | 🔴 +5.53% | 20 |

## 🔴 不稳定项目

Ubuntu 1 项，macOS 29 项；按既定规则均不能通过，未执行第二次确认。

| 平台 / 指标 ID | 首批 | 唯一确认 |
| --- | ---: | ---: |
| ubuntu / `auto-hmr:1:manual:first:restore` | 🔴 +18.79% | 🔴 +1.73% |
| macos / `build:weapp-vite-template:first` | 🔴 +11.29% | 🔴 -6.00% |
| macos / `build:weapp-vite-template:repeat` | 🔴 +13.61% | 🔴 -8.83% |
| macos / `build:weapp-vite-wevu-template:first` | 🔴 +6.75% | 🔴 -11.62% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | 🔴 +8.47% | 🔴 -8.82% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | 🔴 +9.03% | 🔴 +1.89% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | 🔴 +6.93% | 🔴 -9.19% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | 🔴 +5.59% | 🔴 -1.25% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | 🔴 +6.53% | 🔴 -1.93% |
| macos / `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | 🔴 +13.70% | 🔴 +0.15% |
| macos / `hmr:classic:weapp-vite-template:native-page-template:first:restore` | 🔴 +8.21% | 🔴 -0.91% |
| macos / `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | 🔴 +12.60% | 🔴 -0.54% |
| macos / `hmr:classic:weapp-vite-template:native-page-style:first:edit` | 🔴 +13.39% | 🔴 -2.68% |
| macos / `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | 🔴 +6.28% | 🔴 -0.24% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | 🔴 +15.56% | 🔴 +3.18% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | 🔴 +6.59% | 🔴 -5.89% |
| macos / `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | 🔴 +8.01% | 🔴 +4.64% |
| macos / `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | 🔴 +5.99% | 🔴 -4.47% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | 🔴 +14.07% | 🔴 -2.70% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | 🔴 +7.01% | 🔴 +0.27% |
| macos / `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | 🔴 +5.20% | 🔴 +0.86% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | 🔴 +6.25% | 🔴 -6.16% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | 🔴 +6.40% | 🔴 -14.17% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | 🔴 +13.76% | 🔴 +1.93% |
| macos / `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | 🔴 +7.88% | 🔴 +3.35% |
| macos / `auto-build:1:manual:repeat` | 🔴 +8.38% | 🔴 +4.26% |
| macos / `auto-build:20:automatic:repeat` | 🔴 +6.28% | 🔴 +2.07% |
| macos / `auto-build:50:automatic:first` | 🔴 +9.39% | 🔴 +4.92% |
| macos / `auto-build:50:automatic:repeat` | 🔴 +9.55% | 🔴 +1.21% |
| macos / `auto-hmr:20:automatic:repeat:restore` | 🔴 +21.00% | 🔴 -0.85% |

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

## 后续诊断分段（不代表新增采样）

后续版本为 HMR JSON profile 增加六个连续区间：

| 字段 | 区间 |
| --- | --- |
| `finalizePrepareMs` | finalizer 入口至输出准备、样式规范化完成 |
| `finalizeTemplateMs` | 模板规范化、转换与属性移除 |
| `finalizePublishMs` | 模板处理后的作用域样式处理与资产事务发布 |
| `publicationValidateMs` | publication 入口至最终模板校验完成 |
| `publicationIndependentMs` | 等待独立包输出 |
| `publicationPruneMs` | 产物裁剪、sourcemap 同步、子产物 emit 与依赖提交 |

计时只在开发态存在 profile 时启用；保留原异步调用顺序，不额外包装任务。这些字段用于 JSON 诊断，未扩展 CLI 汇总表。本报告的 ade120 原始数据不含这些字段，也没有因此新增性能结论。每次插件调用内的区间连续且互不重复，但独立包与主包可能共享累计 profile，父级等待与子级处理可能重叠，因此不能相加作为互斥耗时，也不能一概视为单次 `writeMs` 的严格子集；其他插件、原生打包器和写盘工作仍未单列，门禁继续使用完整端到端时间。

本次保留已有超过 300 行文件中的插件挂载点、profile 类型与序列化位置，避免诊断改动同时重组发布生命周期；计时辅助函数集中在现有短文件 `utils/hmrProfile.ts`。该诊断不改变构建产物或监听归属，尚需实际 CPU profile 确认回退根因。

## Windows：超时后保留的首批证据

同一 ade120 提交的 Windows 任务 `107950927769` 于 11:02:50 UTC 中止采集，11:04:15 UTC 结束（cancelled）；job 配置上限为 360 分钟。artifact `10860511720` 已成功上传并完整下载，但没有最终 `report.json`，后续完整性检查因文件缺失失败。首批 checkpoint 不能冒充完整门禁报告，整个平台保持 🔴 incomplete。

- 保留 105 个已完成的单侧采集记录：普通构建 14、classic/stateful HMR 各 40、自动导入构建 11。80 个 HMR 记录均带有已知缺项错误，保留其中成功阶段的真实样本。
- 普通构建每项 7 对，最大 +2.22%；本提交 Windows Wevu 重复构建为 3664.46 → 3619.97ms（−1.21%）。这是当前提交首批数据，不是旧提交 +10.57% 的确认批次；旧异常不能据此改判通过。
- 自动导入构建只有 5 个完整配对，加第 6 对 optimized 单侧；第 6 对 baseline 在运行时中止，未补齐；auto-HMR 未开始，所有唯一确认均未执行。
- 两侧 App JSON 缺样本和固定基线 sitemap 失败仍存在。Windows 已保全错误信息中未出现 batch-published 发布协议超时；这不推翻其他平台已有失败。

下列 8 项首批各有完整 20 对且超过 5%，均缺唯一等量确认，结论只能为 incomplete，不能称为已确认回退或通过。

| 场景 | 基线 P50 ms | 当前 P50 ms | 首批变化 | 样本对 |
| --- | ---: | ---: | ---: | ---: |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | 1028.18 | 1084.21 | 🔴 +5.45% | 20 |
| `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | 898.99 | 971.73 | 🔴 +8.09% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | 565.20 | 598.26 | 🔴 +5.85% | 20 |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | 515.73 | 545.09 | 🔴 +5.69% | 20 |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | 398.72 | 463.80 | 🔴 +16.32% | 20 |
| `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | 419.56 | 441.48 | 🔴 +5.22% | 20 |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | 1032.00 | 1089.72 | 🔴 +5.59% | 20 |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | 173.89 | 182.92 | 🔴 +5.20% | 20 |

原始 checkpoint 无损压缩保存在 [ci-ade-windows-primary.json.gz](./ci-ade-windows-primary.json.gz)，解压内容与 artifact 的 `primary.json` 字节一致。SHA-256（未压缩）：`00e4311054c714d9cea90f18f99b480c83bb599c1c5a3ec4b486c1e62528be8c`。未生成或伪造缺失的最终 CI report。

### Windows 自动导入采样器诊断与修正

启动链为 workflow → performanceGate → benchmark-auto-import-build → Node CLI。CLI 通过 Node 可执行文件直接启动，PATH 已按 Windows 分号拼接。Windows 单侧自动导入构建采集约 20 分钟，其中 16 次构建首个单侧批次单次约 63–96 秒；相同驱动在 Ubuntu/macOS 约 2 秒。记录不含足够的 CLI 内部耗时，不能把这些差值全部归因于产品构建。

发现该入口残留另一份 RSS 采样器：每 100ms 启动一次 PowerShell CIM 进程查询，前一探针未结束也继续启动，无超时，stop 还新增一次探针，并将等待纳入构建时间。慢 Windows 探针的确定性测试在修正前一秒内观察到 11 次调用（期望 1），证明可累积并发；当前 CI 日志没有记录每个探针的运行时间，因此尚不能量化该缺陷对六小时超时的贡献。

修正复用普通模板基准现有的串行采样器与有界查询：前次完成后再调度、停止只等待已有探针、失败/超时保持 RSS 不可用。自动导入的实际构建入口也统一使用此实现；从子进程启动至完成记录墙钟时间，再等待内存诊断收尾，同时保留 CLI 内部耗时和内存采样状态用于后续区分。此边界与普通模板构建一致，不扣除构建期间的正常工作。新增测试覆盖慢探针不重叠、停止清理、缺 PID，以及探针延迟不混入构建时间和构建失败时的收尾。

这属于基准设施修正，不是产品性能优化；不修改 ade120 原始记录，不混合修正前后的样本，不改变固定源码基线、7/20 对、唯一确认次数或阈值。新驱动须对两侧应用相同规则，由下一次三平台 CI 验证实际效果。原有超过 300 行脚本仅保留调用及序列化，新进程生命周期逻辑放到独立的 `scripts/benchmarkTemplatesPerformance/measuredBuild.ts`。

验证：7 个定向测试文件共 21 例通过，scoped ESLint 与改动入口依赖闭包的 TypeScript 检查通过。全 scripts typecheck 仍被未触及的 e2e/website/其他脚本错误阻塞，不能记为全量类型检查通过。本轮仅修正基准脚本，不修改产品源码，未启动本地基准或 runtime E2E。
