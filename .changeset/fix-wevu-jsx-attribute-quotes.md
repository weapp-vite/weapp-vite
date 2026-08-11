---
'@wevu/compiler': patch
'@mpcore/simulator': patch
'weapp-ide-cli': patch
---

修复 JSX/TSX 动态属性表达式中的字符串引号导致生成的 WXML 无法编译、dynamic island 模板自递归被微信运行时截断、模拟器未展开 WXML template 调用，以及 `weapp-ide-cli --help` 被错误透传到微信 CLI 的问题。
