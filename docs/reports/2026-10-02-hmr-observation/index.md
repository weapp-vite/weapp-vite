# HMR 观测与编辑序列样本（2026-10-02）

此报告记录 #1133/#1135 的本轮实测和已知边界，不作为 #1134、#1140、#1081/#1082 或总验收 #1142 已完成的证明。实现基线与采样源码摘要见 `provenance.json`；路径已脱敏，数值、步骤与失败状态未筛选。

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

weapp-vite 包级 typecheck、构建、编辑序列单独 tsconfig 检查和范围 lint 通过。完整 scripts tsconfig 仍有其导入的历史 e2e/automator 类型错误；不将其写为通过，当前改动路径无类型诊断。真实宿主批次一致性、原生 WXSS/JSON 分类实测、dev/prod 与缓存恢复仍需后续验证；本报告不替代这些门槛。
