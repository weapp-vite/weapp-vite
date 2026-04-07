---
'create-weapp-vite': patch
'wevu': patch
---

修复 `wevu` 在 `useTemplateRef()` 引用非 wevu 组件实例时的两个运行时问题：一是模板 ref 包装代理对原生实例不可配置属性返回了不符合 Proxy 规范的描述符，导致访问 `__data__` 等字段时抛错；二是 `shallowRef(null)` 初始值在后续参与 setData token 比较时缺少空值守卫，触发 `Object.hasOwn(null, ...)` 异常。
