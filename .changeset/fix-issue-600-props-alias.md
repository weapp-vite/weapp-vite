---
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复 `defineProps` 解构重命名后模板直出表达式仍访问本地别名的问题，确保模板插值、普通属性绑定与自动 computed 均能读取原始 prop。
