---
"@weapp-vite/web": minor
---

继续补齐 Web runtime 的高频兼容桥接能力：

- 新增 `wx.hideKeyboard`，通过 `blur` 当前聚焦输入元素近似桥接收起键盘流程。
- 新增 `wx.loadSubPackage` / `wx.preloadSubpackage`，提供 no-op 成功桥接以兼容分包加载调用链。
- 新增 `wx.getUpdateManager` / `wx.getLogManager`，提供更新流程与日志能力的 Web 占位桥接。

同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确这些能力当前均为 `partial` 实现。
