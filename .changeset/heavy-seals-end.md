---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.setClipboardData` 与 `wx.getClipboardData` 能力，支持在 headless/browser runtime 中稳定读写剪贴板字符串，并把当前剪贴板内容暴露给 session/workbench 快照。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，保证剪贴板交互链路可以稳定验证。
