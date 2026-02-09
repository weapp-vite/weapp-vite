---
"wevu": patch
"create-weapp-vite": patch
---

fix: 修复 WeappIntrinsicElements 属性合并导致 `id` 推断为 `undefined` 的问题。

- 生成器跳过与基础属性（`id/class/style/hidden`）同名的组件属性，避免交叉类型冲突。
- 基础属性 `id` 调整为 `string | number`，使 `map` 等场景可同时接收字符串与数字。
- 补充 `tsd` 回归测试，验证 `WeappIntrinsicElements['map']['id']` 为 `string | number | undefined`。
