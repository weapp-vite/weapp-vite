---
"@weapp-vite/dashboard": patch
---

优化 analyze 体积地图的风险判定：wevu 运行时代码和 weapp-vendors/wevu 产物不再标记为“急需改进”，避免把框架运行时的固有体积误判为业务包体问题。
