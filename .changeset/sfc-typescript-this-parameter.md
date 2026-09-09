---
"@wevu/compiler": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 TypeScript SFC 中显式 this 参数在类型擦除后残留为非法 JavaScript 的问题。生命周期回调、普通函数和对象或类方法现在会正确移除仅用于类型检查的 this 参数，保留函数体中的实际 this 访问。
