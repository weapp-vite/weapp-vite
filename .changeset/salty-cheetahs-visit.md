---
"@weapp-vite/web": minor
---

继续补齐 Web runtime 的高频 API 兼容桥：

- 新增 `wx.saveFile`，支持将临时文件路径近似持久化到 Web 内存文件系统并返回 `savedFilePath`。
- 新增 `wx.createVideoContext`，支持 `play/pause/stop/seek/playbackRate/requestFullScreen/exitFullScreen` 基础控制桥接。
- 新增 `wx.requestSubscribeMessage`，支持模板消息授权结果桥接，并可通过运行时预设注入每个模板的决策结果。

同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确以上能力当前为 `partial` 实现。
