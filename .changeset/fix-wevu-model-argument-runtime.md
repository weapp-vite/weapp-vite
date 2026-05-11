---
"@wevu/compiler": patch
"wevu": patch
"create-weapp-vite": patch
---

修复组件 `v-model:xxx` 在小程序模板与运行时中的事件名归一化和 setup ref 写入行为，确保带参数的双向绑定能按 Vue 语义更新对应父级状态。
