---
"@weapp-vite/web": minor
---

补充 Web runtime 下一批高频桥接 API：

- 权限相关：新增 `wx.getSetting`、`wx.authorize`、`wx.openSetting`，基于运行时内存态维护常见 scope 的授权结果，便于流程调试。
- 媒体相关：新增 `wx.chooseMedia`，通过文件选择器桥接图片/视频选择；新增 `wx.compressImage`，优先使用 Canvas 执行近似压缩并在能力缺失时降级。

同时补齐对应单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial`。
