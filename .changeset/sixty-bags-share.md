---
"weapp-vite": patch
"@wevu/compiler": patch
---

fix(alipay): 按脚本扩展名生成 class/style helper 导出语法。

- 当 helper 输出为 `.sjs` 时，使用 `export default` 导出，避免支付宝 SJS 对 `module` 标识符限制导致的编译错误。
- 当 helper 输出为 `.wxs` 时，继续使用 `module.exports`，保持微信等平台兼容行为不变。
- weapp-vite 在发出 class/style helper 时，改为显式传入当前脚本扩展名，确保不同平台走对应导出策略。
