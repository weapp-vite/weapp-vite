---
"wevu": patch
"create-weapp-vite": patch
---

修复嵌套组件透传 scoped slot 时，组件自身的 `__wvOwnerId` 只写入运行时内存而没有同步到小程序视图层，导致子组件收到空的 `__wvSlotOwnerId`、作用域插槽无法在微信开发者工具中稳定渲染的问题。
