---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 HMR 中 Vue SFC 依赖组件的 transform 缓存复用：当源码、auto-routes 签名和 dirty 状态均未变化时，复用已有编译结果，减少原生页面脚本或样式变更时重复触发 Vue compiler 的开销。
