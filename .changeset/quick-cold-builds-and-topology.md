---
"weapp-vite": patch
"create-weapp-vite": patch
"@wevu/compiler": patch
"@weapp-vite/ast": patch
---

perf: 按命令加载 CLI 执行依赖，复用 Node 模块编译缓存并在 Node 22 和后续版本一致尊重显式缓存目录，复用同轮拓扑扫描与独立分包准备结果，减少模板表达式的重复规范化和作用域构建，以及入口识别和未启用样式入口的 Tailwind 管线中的重复真实路径查询。消除同轮 app Vue 配置的重复求值，保留每轮强制刷新与路由覆盖语义，并在实际转换 WXS 时才加载专用 Babel presets；修正 Babel 8 并行加载时同步 require 的竞态，保持产物与诊断语义。 同一次入口加载中共享原生布局资产的路径发现结果，避免登记、依赖收集和输出阶段重复查询；每轮重新发现文件，保持源码快照与拓扑更新边界。
