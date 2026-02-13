---
"@weapp-vite/web": minor
---

继续补充 Web runtime 的媒体高频桥接能力：

- 新增 `wx.chooseVideo`，基于浏览器文件选择能力完成视频选择并返回临时路径信息。
- 新增 `wx.previewMedia`，支持以浏览器新窗口方式预览媒体 URL，用于调试媒体预览调用链。
- 新增 `wx.saveVideoToPhotosAlbum`，通过浏览器下载行为近似桥接保存流程。

同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力目前均为 `partial` 实现。
