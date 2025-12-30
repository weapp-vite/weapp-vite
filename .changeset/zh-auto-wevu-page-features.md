---
"weapp-vite": minor
"wevu": patch
"website-weapp-vite": patch
---

weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。

- 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
- 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。
