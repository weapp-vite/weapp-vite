---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.chooseVideo` 能力，返回可预测的临时视频文件与基础元数据，并允许直接串联 `wx.saveVideoToPhotosAlbum` 做后续验证。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证视频选择与保存链路可以稳定验证。
