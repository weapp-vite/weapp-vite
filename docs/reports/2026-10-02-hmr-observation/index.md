# HMR 观测与编辑序列样本（2026-10-02）

此报告记录 #1133/#1134/#1135/#1140 的本轮实测和已知边界，不作为 #1134、#1140、#1081/#1082 或总验收 #1142 已完成的证明。实现基线与采样源码摘要见 `provenance.json`；路径已脱敏，数值、步骤与失败状态未筛选。

## 编辑序列

复用 #1059 的序列驱动、compiler fixture、完整基线和发布比较。修正驱动在主线 DevEngine 升级后仍引用已删除 helper、使用 CJS 引擎输出和等待长生命周期 run 的问题：改用原生 ESM DevEngine、已有宿主格式插件，并在 close 后等待 run 完成。没有增加手写产物或第二套比较器。

分别执行 `pnpm verify:edit-sequence --engine classic --resource-cycles 60 --report <report.json>` 和 `--engine stateful-experimental`，全局串行。两组均覆盖原有四个动作族，并各完成 60 次连续依赖编辑；每一步比较新进程完整基线，没有重启长期增量实例来掩盖增长。原始样本分别为 `classic-resources.json` 和 `stateful-resources.json`。每个序列结束后子进程计数均为 0。定向 E2E 15 项通过，另有检测器负向测试覆盖持续增长、缺失观测和失败阶段。

观测来自 compiler/native fixture，不等于整个框架/IDE 的资源全集。load 与 transform 记录实际 hook 调用及去重模块；发布字节累计每次实际发布，可能包含重复文件；补丁次数/字节独立记录。Node 活动资源不覆盖原生库内部所有句柄。原有未引用文件编辑用例断言 load、transform 和发布均为 0。

预热跳过三个样本，四个样本一个中位数窗口。最后三个窗口中，classic RSS 中位数跨度约 1.06 MiB，stateful 约 0.09 MiB；进程监听器均保持 24，受观测资源未超过门禁。样本包含 GC 前增长及回落，不能根据峰值直接判断泄漏。这里仅表示本次有界运行通过，不能外推到任意长时间或所有插件。

## profile 开关对照

相同 Node 24.18.0、darwin arm64、源码、marker seed、场景与迭代数，先开启再关闭 JSONL profile。每组四种 SFC 编辑各十轮，并保存恢复阶段，共每组 80 个更新样本。使用外部 `wallMs` 比较；关闭组没有内部编译阶段。每个编辑/恢复的 `inputSha256` 与另一组逐项相等。原始数据为 `profile-on.json` 和 `profile-off.json`。

| 场景 | 开启 wall 均值 / 中位数 ms | 关闭 wall 均值 / 中位数 ms |
| --- | --- | --- |
| JSON macro | 224.00 / 209.63 | 222.21 / 210.61 |
| template | 233.40 / 235.74 | 203.15 / 208.35 |
| script | 245.90 / 230.32 | 240.30 / 243.63 |
| style | 244.39 / 249.78 | 223.58 / 210.07 |

所有输出断言通过，开启组的关联 profile 全部 available，关闭组全部 disabled。上述是顺序配对运行，未随机交错、未做多轮独立重复，墙钟包含 watcher、构建、输出轮询及宿主调度。样本波动不能直接归因于 JSONL 写盘，也不能把内部阶段求和解释为外部总耗时；不据此宣称固定开销比例、加速或无需优化。

重现时串行运行以下配置，分别令 `TEMPLATES_HMR_PROFILE` 为 1、0，并为两次指定独立报告目录：

```text
TEMPLATES_HMR_FILTER=weapp-vite-wevu-template
TEMPLATES_HMR_SCENARIO_FILTER=vue-page-json-macro,vue-page-template,vue-page-script,vue-page-style
TEMPLATES_HMR_ITERATIONS=10
TEMPLATES_HMR_SAMPLE_MODE=edit-only
TEMPLATES_HMR_RUNTIME=classic
TEMPLATES_HMR_MARKER_SEED=issues1133compare
TEMPLATES_HMR_FAIL_ON_ERROR=1
pnpm exec tsx scripts/benchmark-templates-hmr.ts
```

## 验证边界

weapp-vite 包级 typecheck、构建、编辑序列单独 tsconfig 检查和范围 lint 通过。完整 scripts tsconfig 仍有其导入的历史 e2e/automator 类型错误；不将其写为通过，当前改动路径无类型诊断。完整宿主矩阵、模式切换的目标页面 runtime 与最新候选 CI 仍需后续验证；本报告不替代这些门槛。


## 原生四文件与模式切换补充

`native-batch-acceptance.json` 记录候选 `11fd4eb16` 干净工作区的严格验收：headless 与真实 Stable 2.02.2608080 / 基础库 3.17.2 各 2 场景、9 个检查点通过。覆盖 classic/stateful 的首次、连续、反向保存与恢复，以及 stateful 独立脚本补丁的状态保持；计算样式由真实 DevTools 和 mpcore browser 观察。官方稳定渠道于 2026-10-01 23:12 UTC 核对。真实 IDE 期间发生模拟器启动错误和 bootstrap 超时，自动恢复后所有强断言通过，没有切换渠道、删除全局资源或放宽断言。

`mode-sequences.json` 和 `mode-sequence-provenance.json` 是完整 weapp 插件的新观察器样本，复用同一 driver、首个分歧和 worker 资源管理。默认清理与共享目录两组各 8 个步骤通过，结束后子进程均为 0。覆盖 production→dev→production、dev→production、组件移动/删除、分包及页面迁移/删除、共享依赖变化、旧缓存恢复。每一步完整生产磁盘文件集合与独立进程基线逐字节相等，并检查 emitted JS 引用与 app 路由文件存在。

共享目录组使用集成层产物清单清理，且每个模式完成后都确认用户文件仍在。缓存内容来自先前原生构建，只有缓存恢复示例写入该快照；框架构建仍完全由 Vite/Rolldown emit/write。负向单测证明用户改写与同名未知内容会拒绝清理或覆盖。本轮没有证明核心构建器违反 `emptyOutDir: false` 契约，不以清空共享目录冒充修复。这些步骤的 `rapid` 动作仅组合模式切换前的输入，不声称覆盖活跃 watcher 的快速保存；耗时也不作为 HMR 延迟或提速证据。

## 原生依赖与入口拓扑

候选 `9f3c9ab03` 干净工作区的严格 headless 与 Stable 验收各 2 场景、12 个检查点通过，运行时 error/exception 均为 0。原始检查点及观察值见 `native-topology-acceptance.json`；Stable 渠道于 2026-10-02 01:00 UTC 核对，版本 2.02.2608080、基础库 3.17.2，官方来源和安装核对见 `native-topology-ide-selection.json`。涵盖 classic/stateful 样式导入链更新与恢复、新增组件渲染、新增页面导航、撤销后原页面恢复；headless 不提供计算样式，计算颜色另由 Stable 与 mpcore Chromium 用例验证。

真实 IDE 验收期间出现模拟器启动错误和 bridge bootstrap 重试。Computer Use 读取 Stable 窗口，重新打开本轮测试项目后复查；自动重试完成后全部强断言通过。没有重启共享宿主、删除全局资源或修改验收断言。此前诊断运行因 warmup 选择器错误失败，修正为各 fixture 页面共同根节点后重新执行本次严格验收；旧诊断通过不作为候选证据。

`native-classic-samples.json`、`native-stateful-samples.json` 保存同候选、Node 24.18.0、darwin arm64 的九类原生编辑完整样本。每类 5 轮并包含恢复，各 90 样本；两组 90 对输入 SHA256 全部一致。开启 profile 和输出范围观察，使用固定 marker seed `issues1134native`。汇总与限制见 `native-profile-provenance.json`。

| 编辑类别 | classic wall 中位数 ms | stateful wall 中位数 ms |
| --- | --- | --- |
| 原生脚本 | 182.0 | 186.6 |
| 原生模板 | 288.1 | 407.3 |
| 普通 WXSS | 290.7 | 323.6 |
| WXSS 导入链 | 289.6 | 326.9 |
| SCSS | 394.0 | 402.6 |
| Tailwind 内容 | 421.0 | 436.2 |
| 局部 JSON | 414.6 | 428.4 |
| 组件拓扑 JSON | 708.9 | 1081.0 |
| 页面拓扑 JSON | 865.6 | 1098.6 |

两组组件及页面拓扑都超过默认 500 ms 观察预算，保留为待调查项。classic 内部 profile 全部 available；stateful 全部 `unavailable-stateful`，未知阶段没有折算为零。磁盘范围记录实际 added/changed/removed 及字节差异，不代表 write 次数或全部转换成本。基线在导入链及拓扑场景功能失败，因此不能将其超时作为性能基线，也没有据此宣称提速或无需优化。

复现入口为 `scripts/benchmark-templates-hmr.ts`，指定 `TEMPLATES_HMR_PROJECT_ROOT=e2e-apps/github-issues/fixtures/issue-1134-profile`、`TEMPLATES_HMR_RUNTIME=classic` 或 `stateful-experimental`、`TEMPLATES_HMR_ITERATIONS=5`、`TEMPLATES_HMR_SAMPLE_MODE=edit-only`、`TEMPLATES_HMR_PROFILE=1`、`TEMPLATES_HMR_OUTPUT_SCOPE=1`、`TEMPLATES_HMR_MARKER_SEED=issues1134native`，两组全局串行。运行器复制 fixture 到临时项目后构建，不在受版本管理 fixture 内启动 watcher。
