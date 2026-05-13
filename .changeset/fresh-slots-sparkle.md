---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复页面级 Vue SFC 作用域插槽渲染时的内部 owner 标记注入边界，避免页面被错误当作组件宿主注入内部 props，并让作用域插槽 owner 快照同步保持在运行时数据快照内。
