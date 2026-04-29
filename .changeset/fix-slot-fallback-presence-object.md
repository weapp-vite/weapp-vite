---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 组件 `<slot>` 兜底内容生成过长 `vueSlots` 数组扫描表达式的问题。编译器现在会将插槽元信息转换为对象绑定，并用 `vueSlots.<name>` 生成短条件分支，避免默认内容降级产物异常。
