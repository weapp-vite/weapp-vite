---
"@weapp-vite/web": minor
---

继续补充 Web runtime 的登录与用户信息高频桥接能力：

- 新增 `wx.checkSession`，提供会话有效性占位校验并支持预设会话状态注入。
- 新增 `wx.getUserInfo` / `wx.getUserProfile`，提供用户信息读取与授权确认流程桥接，可通过预设结果注入用户资料。

同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。
