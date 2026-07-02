---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化应用入口扫描阶段的文件探测顺序，并行发现 app 配置、脚本入口、prelude 与 Vue 入口，同时并行加载 sitemap/theme 侧边配置，减少构建与 HMR 入口刷新时的串行文件系统等待。
