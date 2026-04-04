---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.chooseImage` 能力，返回可预测的临时图片文件与 `tempFilePaths` / `tempFiles` 结果，并让生成的图片元数据能够被 `wx.getImageInfo` 继续读取。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片选择与后续信息查询链路可稳定验证。
