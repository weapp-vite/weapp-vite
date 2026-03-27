---
'@mpcore/simulator': minor
---

为 `@mpcore/simulator` 增加了 `wx.downloadFile`、`wx.saveFile`、`wx.uploadFile` 的 headless/browser 模拟能力，并补充对应的文件快照、mock 日志与类型覆盖。同时修复 browser e2e Vitest 配置，使其与 `mpcore/demos/web` 一致注册 Tailwind Vite 插件，保证测试环境能够正确处理 Tailwind v4 样式入口。
