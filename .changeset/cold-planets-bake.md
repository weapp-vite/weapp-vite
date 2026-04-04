'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.getFileInfo` 能力，支持读取临时文件与保存文件的稳定文件大小和摘要信息，并兼容 `md5`、`sha1` 两种摘要算法。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证文件摘要查询链路可以稳定验证。
