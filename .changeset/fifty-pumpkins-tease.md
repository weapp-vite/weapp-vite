---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `tdesign-miniprogram/*` 这类通过相对 `node_modules` 的 `miniprogram_dist` / `miniprogram` alias 引入时的 npm 路径归一化。现在这类路径会在依赖识别与产物重写阶段恢复成稳定的包内入口，避免命令式调用 `Dialog.confirm()` 等 API 时命中错误的模块包装层。
