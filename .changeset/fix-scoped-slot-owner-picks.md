---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

保留仅在增强插槽模板中使用的父组件数据依赖，避免自动 setData 裁剪导致插槽内组件首次挂载收到空值；动态依赖无法完整分析时保留完整快照。
