---
"wevu": patch
"create-weapp-vite": patch
---

修复增强作用域插槽在属性 observer 早于 attached 触发时，运行时计算绑定无法读取 `__wvSlotPropsData` / `__wvOwner` 的问题，避免首页 `KpiBoard` 这类 `#items` + `v-for` 场景初次渲染时出现 `Cannot read property 'items' of undefined`。
