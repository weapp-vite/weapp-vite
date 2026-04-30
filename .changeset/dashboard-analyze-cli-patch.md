---
"@weapp-vite/dashboard": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 analyze 的 CLI、报告和预算能力：新增可配置包体预算、`wv analyze --budget-check` 预算门禁、`wv analyze --report pr` 精简 PR 报告、历史快照与 Markdown 报告输出，并在 dashboard 中展示真实 gzip/brotli 体积、历史对比、预算告警、重复模块建议、来源细分和一键复制/导出能力。

新增 dashboard UI 本地验证项目，并让 `wv dev --ui` 在仓库开发态优先读取 dashboard 源码入口，方便验证首页、分析页、活动流、设计令牌和 dashboard-ui-lab 的低预算失败校验链路。
