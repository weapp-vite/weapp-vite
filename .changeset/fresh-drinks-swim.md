---
'@wevu/compiler': patch
---

fix object-literal component prop binding in template compilation

- 修复组件属性 `:prop="{ ... }"` 在小程序模板中生成非法属性表达式的问题
- 将顶层对象字面量绑定下沉到运行时 `__wv_bind_*` 计算属性
- 新增 `e2e-apps/object-literal-bind-prop` 与对应 e2e 回归测试
