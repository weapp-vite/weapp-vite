---
"weapp-vite": patch
"create-weapp-vite": patch
---

保留 Wevu 稳定公开组件工厂及已有生命周期导出调用的原始形式，修复全量与增量构建的额外别名包装不一致，避免纯模板 HMR 改写无关脚本并导致微信开发者工具整页重载和状态丢失。
