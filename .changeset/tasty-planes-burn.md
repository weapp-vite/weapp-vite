---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.chooseMedia` 能力，支持按稳定顺序返回图片与视频混合的临时媒体文件结果，并允许与 `wx.getImageInfo`、`wx.saveVideoToPhotosAlbum` 串联验证。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证混合媒体选择链路可以稳定验证。
