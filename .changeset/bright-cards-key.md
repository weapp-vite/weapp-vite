---
'@wevu/compiler': patch
'wevu': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 Wevu 模板中 `v-for` 使用嵌套或复杂 `:key` 表达式时被截断为首段字段的问题。编译器现在会自动生成带内部基础类型 key 的列表投影，保持事件仍解析到原始列表项，用户无需手动扁平化数据。
