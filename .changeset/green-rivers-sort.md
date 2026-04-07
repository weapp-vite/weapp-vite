---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.chooseMessageFile` 能力，支持按稳定顺序返回可预测的临时消息文件结果，并允许与 `wx.getImageInfo`、`wx.getVideoInfo` 串联验证图片与视频附件场景。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证消息文件选择链路可以稳定验证。
