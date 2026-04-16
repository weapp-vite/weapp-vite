---
'@weapp-vite/vscode': patch
---

增强 VS Code 扩展中 WXML 与识别到的 weapp-vite Vue 模板的表达式定义跳转能力。现在会识别 `wx:for` 局部变量作用域，并区分事件表达式中对象、方法与参数 token 的跳转目标，让 `handlers.onTap(product, idx)`、`{{ product.name }}` 等场景的跳转结果更准确。
