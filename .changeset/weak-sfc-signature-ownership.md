---
"@wevu/compiler": patch
---

修复持续编辑 Vue SFC 时签名缓存永久保留历史源码与载荷的问题，使缓存随 Vue 解析结果释放，同时保持 HMR、JSON 宏和样式变化的签名语义。
