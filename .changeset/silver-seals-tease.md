---
"@wevu/compiler": patch
---

fix: 修复模板事件修饰符在小程序平台的事件前缀映射。

- Vue 模板编译新增 `@tap.catch`、`@tap.capture`、`@tap.capture.catch`、`@tap.mut` 的事件前缀识别与转换。
- 微信/抖音/百度平台按修饰符输出 `catchtap`、`capture-bind:tap`、`capture-catch:tap`、`mut-bind:tap`。
- 支付宝平台保持对应语义输出 `catchTap`、`captureTap`、`captureCatchTap`，并补充多平台矩阵测试覆盖。
