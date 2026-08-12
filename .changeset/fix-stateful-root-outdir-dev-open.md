---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复源码根目录包含构建输出目录时，stateful HMR 反复监听自身产物导致初次构建无法完成的问题；隔离独立分包与主包的 Vite 插件状态，避免 Tailwind CSS 初始产物偶发为空或归属错误；同时避免 `dev -o` 将已连接但暂时无法截图的微信开发者工具会话误判为未打开并重复启动。
