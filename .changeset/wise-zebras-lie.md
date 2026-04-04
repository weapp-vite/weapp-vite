---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.getImageInfo` 能力，支持读取 `canvasToTempFilePath` 导出的临时图片元数据，并在普通文件场景下回退到基于路径扩展名的图片类型推断。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片信息查询与导出链路可稳定验证。
