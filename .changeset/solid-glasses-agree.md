---
'@wevu/compiler': patch
weapp-vite: patch
create-weapp-vite: patch
---

fix class/style runtime stability for dynamic class expressions and scoped-slot v-for cases

- 为 class/style 的 JS 运行时计算增加表达式异常保护，避免在 `v-if` 守卫与列表项暂不可用时中断渲染
- 修复 scoped slot 虚拟模块在 class 计算代码中缺失 `unref` 导入的问题
- 补充相关单元测试与 e2e 回归用例，覆盖 `v-for` 动态 class 与 `root.a` 这类场景
