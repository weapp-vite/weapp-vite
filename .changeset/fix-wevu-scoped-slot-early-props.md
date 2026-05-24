---
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复增强作用域插槽在属性 observer 早于 attached 触发时，运行时计算绑定无法读取 `__wvSlotPropsData` / `__wvOwner` 的问题，避免首页 `KpiBoard` 这类 `#items` + `v-for` 场景初次渲染时出现 `Cannot read property 'items' of undefined`。同时作用域插槽 props 尚未同步时，编译器生成的 scoped slot `v-for` 数据源保护会先按空列表处理，不再把初始化时序记录为模板运行时错误。
