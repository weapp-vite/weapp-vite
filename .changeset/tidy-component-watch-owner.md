---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复自动导入组件更新时重复触发引用方构建的问题，保持组件 HMR 的单次发布和状态恢复，同时保留组件新增、删除及未入图源码的发现能力。
