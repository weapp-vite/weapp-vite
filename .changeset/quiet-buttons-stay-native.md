---
"@wevu/compiler": patch
---

修复 auto 模式下第三方小程序原生组件默认插槽被误判为增强作用域插槽的问题，避免 TDesign/Vant 等 kebab-case 原生组件在普通插槽内容中生成 `generic:scoped-slots-*`。
