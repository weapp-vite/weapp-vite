---
"@weapp-vite/web": minor
---

继续补充 Web runtime 的媒体与刷新兼容桥接：

- 新增 `wx.getVideoInfo`，优先读取运行时预设并降级到浏览器 video 元信息读取。
- 新增 `wx.compressVideo`，提供 no-op 兼容桥接（默认返回原路径），并支持注入预设压缩结果用于调试。
- 新增 `wx.startPullDownRefresh` no-op 成功桥接，与既有 `wx.stopPullDownRefresh` 形成完整调用链兼容。

同时补齐对应 `canIUse`、单测和 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。
