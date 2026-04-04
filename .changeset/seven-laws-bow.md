---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.getVideoInfo` 能力，支持读取 `wx.chooseVideo` 与 `wx.chooseMedia` 生成的临时视频文件元数据，并返回稳定的时长、尺寸、码率、帧率与文件大小信息。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证视频元数据读取链路可以稳定验证。
