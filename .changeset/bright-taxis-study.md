---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 Rust 版 Vue SFC signature payload 解析路径，并为 `weapp-vite` 的 HMR signature 增加可选 native 回退机制，以降低热更新与构建热点开销。
