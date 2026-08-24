---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 与 JSX 模板中的数字字面量分隔符被原样输出到 WXML 的问题，编译时会将其转换为小程序模板可识别的数字写法。
