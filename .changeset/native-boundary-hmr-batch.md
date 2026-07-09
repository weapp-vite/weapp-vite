---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 sidecar snapshot watcher 的连续事件处理，将同一微任务窗口内的多个 sidecar 变更合并为一次 snapshot 构建，减少重复进入 Vite/Rolldown native 构建链路的次数。同时补充 AI/AGENTS 规范，明确 Rust/native 加速应优先减少 JS 与 Rust 的通信次数，并保留现有 Babel/Oxc/Vue compiler 回退路径。
