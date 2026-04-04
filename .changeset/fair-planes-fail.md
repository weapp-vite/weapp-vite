---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.saveImageToPhotosAlbum` 能力，用于消费 `canvasToTempFilePath` 产生的临时文件，并在文件缺失时返回与小程序风格一致的失败信息。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证导出画布后的保存链路可验证。
