---
"weapp-vite": patch
"create-weapp-vite": patch
---

提前过滤不含 Wevu 页面特性的脚本，避免增量构建反复加载无关页面清单，同时保留构建结束释放缓存和路由变更后的页面识别更新。
