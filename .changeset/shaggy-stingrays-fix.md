---
"@weapp-vite/web": minor
---

继续补齐 Web runtime 的页面背景能力桥接：

- 新增 `wx.setBackgroundColor`，支持将背景色设置近似映射到 Web 页面样式。
- 新增 `wx.setBackgroundTextStyle`，支持 `light/dark` 文本样式设置并提供非法参数校验。

同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确上述能力均为 `partial` 实现。
