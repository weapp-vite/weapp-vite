---
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复小程序模板编译时 kebab-case 自定义事件的绑定属性生成规则：`@overlay-click` 现在会输出 `bind:overlay-click`（以及 `catch:overlay-click`），不再错误输出 `bindoverlay-click`。同时补充 issue #316 的单元与 e2e 回归覆盖，确保构建产物和 DevTools 运行时都能正确触发事件。
