---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 Rust 版 Vue SFC signature payload 解析路径，并为 `weapp-vite` 的 HMR signature 增加显式本地 native 模块路径开关；未配置 native 模块路径时继续使用 TypeScript 实现，避免影响 `weapp-vite` 的正常发布。
