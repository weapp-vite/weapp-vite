---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared style import 注入时的缺失列表构造，避免已包含全部共享样式 import 的 CSS 在 build/HMR 生成阶段创建临时数组。
