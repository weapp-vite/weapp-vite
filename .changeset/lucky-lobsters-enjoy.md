---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.previewImage` 能力，并在 runtime 中暴露稳定的预览快照状态，便于 headless/browser 场景下验证当前预览图片与候选列表。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，确保图片预览调用与调试桥快照保持一致。
