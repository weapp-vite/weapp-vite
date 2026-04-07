---
'@mpcore/simulator': patch
---

继续补齐 `@mpcore/simulator` 的 loading 能力验证链路：为 `wx.showLoading` / `wx.hideLoading` 增加 demo、browser e2e 与 session/workbench 快照覆盖，让 Web 模拟器可以稳定观察 loading 显隐状态，并在类型测试中锁定对应 API 与快照契约。
