---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享样式入口的生成阶段，并发执行共享样式文件存在性检查、预处理和后处理，同时保持原配置顺序写回资源，减少 shared style 影响多个页面/组件时的 HMR 与构建等待。
