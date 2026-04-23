---
"weapp-vite": patch
"create-weapp-vite": patch
---

在开发态文件型热更新中，当启用 HMR profile JSONL 输出且最近一次重建明显慢于近期均值时，追加提示开发者运行 `weapp-vite analyze --hmr-profile`，把慢样本诊断从日志直接闭环到结构化分析命令。
