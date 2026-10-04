# 脚本分析的 JS 基线实验

此工具用诊断加载器验证四项 JS 优化的语义边界，为后续 Rust 完整阶段实验提供更强的对照。它不修改生产源码，不启用 native，也不采集耗时。

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/scriptAnalysisBaseline
pnpm exec tsc -p scripts/scriptAnalysisBaseline/tsconfig.json
node --import tsx scripts/scriptAnalysisBaseline/check.ts --output=.codex-tmp/script-baseline-check
```

输出目录必须不存在。七个独立进程按顺序运行原始编译器、相同 loader 控制组、四项单独优化及组合版本。每个场景调用两次，均对照原始编译器的首次完整返回值、sourcemap、告警和错误，防止已改写 AST 在后续调用中被错误复用。错误对照包含 name/message 及公开诊断的 code/severity/filename/source/loc，不比较 stack 或任意 cause。

| 实验 | 约束 |
| --- | --- |
| AST 所有权移交 | 仅同次编译、最终源码逐字相同且 fast path 未命中时消费一次；不强制触发懒解析，异常和未消费 token 均释放 |
| props visitor 不构建 scope | 只对不查询 binding 的 return-info visitor 启用 `noScope` |
| page-meta 负向检查 | 使用现有 `mayContainPageMeta`；可能包含宏或转义时保留原分析 |
| reserved-props 负向检查 | 无告警回调、无源码，或既无 `defineProps` 又无反斜杠时跳过；正向语义不变 |

32 个场景包含真实页面、压力模板、嵌套循环、slot、JSX、TSX 源码变化、宏别名/转义/遮蔽、reserved-props 类型及运行时声明、Unicode/CRLF 和错误清理。报告要求所有预期分支实际命中，结束时无活动编译或待消费 token。

`report.json` 保存编译器和诊断源码 hash、场景源码及完整输入 hash、每次输出 hash 与计数。每个 worker 回传实际输入摘要，与父进程预读的场景逐项比对，防止真实页面语料在进程间变化。完整输出保存在各 worker JSON；CI 只上传摘要和去除仓库路径的日志。采集前后核对源码身份，依赖身份由 lockfile 记录，未逐文件重算已安装依赖。

此结果只证明所列场景的转换一致性。性能、完整 Vite/HMR、RSS、小程序运行时和生产接入仍需各自验证。源加载替换锚点必须唯一，编译器结构变化时工具应失败，不能静默跳过实验。
