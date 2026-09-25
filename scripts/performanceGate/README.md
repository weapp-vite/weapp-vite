# 成对性能验收

PR 性能任务在同一 runner 上先准备两份 checkout，再使用当前提交中的同一个驱动串行交替采样。PR 的基线固定为目标分支与 HEAD 的 merge-base，并在报告中记录完整 SHA，避免 main 后续依赖升级混入本次改动。

- 每个模板的首次、重复构建分别采集 7 对。首次清理项目输出；重复保留输出，两次都新建 CLI 进程，不声称清空 OS 缓存。
- classic 和 stateful 的每个 HMR 场景分别采集 20 对。每对新建 dev 会话，在会话中分别保留首次编辑、恢复、连续编辑和恢复；以真实可达产物确认完成，不选两者中的较快值。
- 自动导入保留 1、20、50、69 个组件（当前解析表共 69 个；旧驱动请求 100 时实际也只覆盖 69 个），分别比较两份提交的手动注册和自动导入。支持文件保持正常配置。同提交的自动导入开销单列，并保留 25% 且 200 ms 的既有功能预算。
- CLI 日志先移除 ANSI，再提取内部构建时间。端到端耗时、CLI 内部、CLI 外部、可用的 compiler profile 分别保留；缺失 profile 不用端到端数字冒充。
- 构建 RSS 是采样到的进程树峰值；HMR RSS 和堆为 dev 进程 GC 后的快照。RSS 不等同于堆，也不宣称离散采样捕获了瞬时真实峰值。

所有同配置跨提交场景使用中位数比较。当前减基线，正数表示成本增加。超过 5% 的场景只执行一次固定等量确认：两批都超过阈值则失败；确认回到阈值内则标为不稳定，同样失败。没有绝对毫秒豁免，也不自动重试到通过。P95 和成对增量保留在 JSON 中，不用整体平均值抵消个别场景退化。

计时前发现并冻结两侧模板和场景清单。缺少模板、runtime、编辑/恢复阶段、有效样本，或基线、产物检查、关闭进程失败，均不可通过。独立完整性检查从原始样本重算结论，不只读取保存的 `gate.status`。每侧完成后落盘 checkpoint，失败不会抹去已采集数据。

`TEMPLATES_PERF_DIAGNOSTIC_PAIRS` 只能缩短诊断轮次，完整性判据仍要求 7/20 对，因此诊断运行不得显示验收通过。`TEMPLATES_PERF_SKIP_PREPARE=1` 只用于复用已准备的诊断 checkout，必须保留 `preparation/prepared.json` 且 SHA 一致。

```sh
TEMPLATES_PERF_BASELINE_DIR=../baseline TEMPLATES_PERF_OPTIMIZED_DIR=. pnpm exec tsx scripts/performanceGate/index.ts
```

在 Windows PowerShell 中使用对应的 `$env:` 语法设置变量。两个 checkout 的依赖先按各自锁文件安装，驱动再重建所需包。最终产物仍由各自的 Vite/Rolldown 构建写出。

自动评论仍由 main 的可信脚本负责；本目录不改变高权限工作流的脚本来源。报告设施前置 PR 未合并期间，以本任务写入的 Actions 摘要和原始 artifact 为准。
