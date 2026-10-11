---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
---

perf: 按命令加载 CLI 执行依赖，复用 Node 模块编译缓存并在 Node 22 和后续版本一致尊重显式缓存目录，复用同轮拓扑扫描与独立分包准备结果，减少模板表达式的重复规范化和作用域构建，以及入口识别和未启用样式入口的 Tailwind 管线中的重复真实路径查询，保持产物与诊断语义。
