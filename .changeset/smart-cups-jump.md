---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.saveVideoToPhotosAlbum` 能力，允许基于 headless/browser runtime 中的临时文件完成视频保存调用，并在文件不存在时返回稳定的失败信息。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，确保视频临时文件保存链路与图片保存能力保持一致。
