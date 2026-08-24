---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue 与 JSX 模板中的 JavaScript 数字字面量被原样输出到 WXML 的问题。编译时会将二进制、八进制、十六进制和带分隔符的 Number 转为十进制，并按小程序数据边界安全转换 BigInt，避免模板编译错误和精度丢失。
