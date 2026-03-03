---
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中两个会导致微信运行时异常的模板问题：一是 `swipeout` 组件错误生成 `capture-@tap` 等非法 WXML 属性，改为合法的 `capture-bind:*` / `bind*` 绑定；二是自定义 tabbar 的 `@change` 事件在产物中触发 `onChange is not a function`，改为稳定的原生 `bindchange` 绑定方式，避免事件映射覆盖方法定义。
