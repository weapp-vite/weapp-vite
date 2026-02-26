---
"wevu": patch
"create-weapp-vite": patch
---

新增 `NativeComponent<Props>` 类型导出，用于简化原生小程序组件在 `script setup` 场景下的类型包装写法；同时补充 `wevu-vue-demo` 原生组件示例（含 `TS + SCSS` 版本）与对应页面引入演示，使原生组件 `props` 在模板中的智能提示与类型约束更稳定、易用。
