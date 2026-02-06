---
"@wevu/compiler": patch
---

fix: 修复支付宝 SJS 运行时对 `Array` 标识符的兼容问题。

- `class/style` 运行时辅助脚本不再使用 `Array.isArray`，改为通过 `Object.prototype.toString` 判断数组。
- `hyphenate` 不再依赖 `String.fromCharCode`，改为 `charAt(i).toLowerCase()`，降低 SJS 语法限制下的风险。
- 增加对应测试断言，确保后续不会再次生成含 `Array` 标识符的 SJS 辅助代码。
