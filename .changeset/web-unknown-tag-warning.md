---
"@weapp-vite/web": patch
---

fix(web): 在编译期提示可能拼写错误或未注册的 WXML 标签，并覆盖 include/import 模板依赖。合法 HTML、SVG、MathML、官方原生组件及编译器注入的导航栏不产生未知标签告警，既有渲染行为保持不变。
