---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复通过目录别名、junction 或 Windows 等价路径运行状态保持 HMR 时的源码归属判断，避免原生组件补丁被误拒绝，并确保分包 factory 的外置 npm 导入仍指向所属分包。
