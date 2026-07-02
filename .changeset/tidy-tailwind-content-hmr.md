---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Tailwind 内容类名 HMR 后 `app.wxss` 可能继续复用旧 JIT 输出的问题。现在在没有 Rust native binding 的环境下，Vue/template 内容变更也会触发 app 样式入口重新参与 Tailwind 生成，并保持现有 JS fallback 路径可用。
