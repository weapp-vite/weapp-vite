---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复增强作用域插槽中 `v-for` 读取父级数据时的初始化报错，避免 `__wvOwner` 尚未绑定时输出模板数据源执行失败。同时延后 `setup` 方法注入前的首次模板快照，减少 IDE 真实运行时中的模板表达式和插槽投影告警。
