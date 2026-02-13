---
"@weapp-vite/web": minor
---

为 Web runtime 补充一批高频兼容桥接能力：

- 新增 `wx.chooseLocation`，支持通过预设结果或 `prompt` 输入经纬度完成基础选点流程调试。
- 新增 `wx.getImageInfo`，基于浏览器 `Image` 对象提供图片宽高与类型读取。
- 新增 `wx.showTabBar` / `wx.hideTabBar` no-op 成功桥接，用于兼容调用链。

同时补齐对应单测与 Web 兼容矩阵文档说明，明确上述能力当前均为 `partial` 实现。
