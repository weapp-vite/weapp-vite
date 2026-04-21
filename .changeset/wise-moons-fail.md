---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复主包页面使用 `tdesign-miniprogram/dialog` 与 `tdesign-miniprogram/dialog/index` 时的 npm 路径本地化错误：现在会把主包 JS `require` 与 `usingComponents` 正确重写到 `dist/miniprogram_npm`，并对目录入口显式补齐 `/index`，避免微信运行时报 `Dialog.confirm is not a function` 或 `组件路径未找到`。同时新增专用 e2e app、构建回归测试与 DevTools 运行时回归测试覆盖该场景。
