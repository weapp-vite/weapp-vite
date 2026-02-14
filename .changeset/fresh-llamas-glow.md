---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。

同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。
