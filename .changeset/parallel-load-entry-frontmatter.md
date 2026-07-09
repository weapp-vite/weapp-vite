---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化入口加载前段的文件发现与 JSON 读取等待，并行探测 JSON/Vue 入口并在读取已解析 JSON 的同时注册预测 watch 目标，减少页面、组件和应用 HMR 刷新时的串行 I/O。
