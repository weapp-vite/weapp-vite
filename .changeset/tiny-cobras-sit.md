'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.openDocument` 能力，支持校验临时文件与保存文件是否存在、推断或接收文档类型，并把最后一次打开的文档状态稳定暴露给 session/workbench 快照。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证文档打开链路可以稳定验证。
