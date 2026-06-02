---
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 performance 预设下极简 slot 场景仍可能误渲染 fallback 的问题。组件初始同步时会把 `vueSlots`、`__wvSlotOwnerId` 与 `__wvSlotScope` 同步到原生顶层 data，并且自动 `setData.pick` 会稳定保留这些 slot 桥接字段，避免普通插槽和作用域插槽在首轮渲染中读取到默认空值。
