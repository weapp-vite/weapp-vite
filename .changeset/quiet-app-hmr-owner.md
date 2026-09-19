---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复连续 HMR 中 App 入口被普通编译脚本覆盖、外部 CSS 变量删除后恢复时模块图漂移，以及开发期复用失效解析上下文的问题，避免注册初始化丢失、页面白屏或后续重建中断。
