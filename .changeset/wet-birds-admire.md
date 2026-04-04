---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.compressImage` 能力，支持基于已有临时图片文件生成新的压缩结果文件，并让压缩后的输出继续被 `wx.getImageInfo` 读取元数据。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片选择、压缩与信息读取链路可以稳定验证。
