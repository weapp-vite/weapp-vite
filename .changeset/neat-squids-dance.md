---
"wevu": patch
"create-weapp-vite": patch
---

收紧 `wevu/router` 初始化路由配置校验：当路由记录存在空 `name/path`、重复 `alias`（含与主路径相同）或循环 `children` 引用时，会输出告警并跳过无效部分，避免潜在的匹配歧义与递归风险。

同时补充回归测试，覆盖无效记录跳过、alias 归一化告警与循环引用处理，确保 `addRoute` 与初始化场景行为稳定。
