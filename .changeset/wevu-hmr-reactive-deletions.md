---
"wevu": patch
"create-weapp-vite": patch
---

修复状态保持热更新时 reactive 对象中已删除的字段重新出现的问题，同时保留新代码新增的默认字段与嵌套响应式对象的引用。恢复宿主快照时保留 store 方法及嵌套 ref 身份，避免闭包操作失效或热更新后的 store 操作报错。
