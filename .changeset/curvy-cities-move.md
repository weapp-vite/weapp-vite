---
"@weapp-vite/web": minor
---

继续补充 Web runtime 的地址与授权高频桥接能力：

- 新增 `wx.chooseAddress`，支持通过运行时预设或 `prompt` 输入完成地址选择流程调试。
- 新增 `wx.openAppAuthorizeSetting`，提供应用级授权状态桥接并支持预设状态注入。
- 新增 `wx.getFuzzyLocation`，优先读取运行时预设并降级到定位结果模糊化（经纬度保留两位小数）桥接。

同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。
