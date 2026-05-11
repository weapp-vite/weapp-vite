---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `slotSingleRootNoWrapper` 遇到带 `v-if` 的单根具名插槽内容时，会把 `slot` 属性错误下推到生成的 `<block>` 上的问题。现在结构指令保留在外层 `<block>`，具名 `slot` 会继续下推到实际的单根元素，避免小程序运行时丢失投影内容。
