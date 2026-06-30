---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 的样式与模板类 HMR：当脚本与模板相关签名未变化时复用已有 SFC 编译结果，只刷新样式产物与本地资源输出，减少 style-only / template-only 更新触发的重复 Vue 编译与 JS 入口刷新。
