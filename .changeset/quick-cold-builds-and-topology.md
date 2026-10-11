---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

perf: 按命令加载 CLI 执行依赖，复用同轮拓扑扫描与独立分包准备结果，并减少模板表达式的重复规范化和作用域构建，保持产物与诊断语义。
