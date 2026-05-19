---
"@wevu/compiler": patch
---

收窄组件成员路径 prop 绑定的运行时 computed 回退规则，避免普通成员数据绑定被不必要地生成 `__wv_bind_*`，同时保留函数 prop 的路径元数据以支持透传。
