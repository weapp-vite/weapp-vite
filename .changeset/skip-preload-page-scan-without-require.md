---
"weapp-vite": patch
"create-weapp-vite": patch
---

在没有 require 调用的 bundle 中跳过隐式页面预加载扫描，减少生成阶段的无效页面入口遍历。
