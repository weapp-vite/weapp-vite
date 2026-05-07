---
"@wevu/compiler": patch
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 augmented 作用域插槽在多层默认插槽组件嵌套时只生成第一层 scoped slot 资源的问题，并补齐嵌套 scoped slot 组件 JSON 的泛型与依赖声明，避免内层插槽内容在小程序运行时丢失。
