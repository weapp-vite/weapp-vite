---
"@weapp-vite/web": minor
---

继续补充 Web runtime 的文件与视频编辑兼容桥接能力：

- 新增 `wx.chooseFile`，基于文件选择器桥接通用文件选择，支持 `extension` 过滤并返回临时文件信息。
- 新增 `wx.openVideoEditor`，提供 API 级兼容桥接（默认返回原视频路径），并支持注入预设编辑结果用于流程调试。
- 新增 `wx.saveFileToDisk`，通过浏览器下载行为近似桥接文件保存流程。

同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。
