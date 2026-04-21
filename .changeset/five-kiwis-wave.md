---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生小程序页面默认导入 `tdesign-miniprogram/dialog` 或 `tdesign-miniprogram/dialog/index` 时的 ESM/CJS 互操作回归。现在当页面产物中的 npm require 已被本地化到 `miniprogram_npm` 后，`weapp-vite` 会同步去掉错误的 `__toESM(..., 1)` Node 模式包装，避免 `Dialog.confirm is not a function` 这类双层 `default` 问题；同时补齐 copied `miniprogram` / `miniprogram_dist`、alias 回写、本地化构建产物与 DevTools 运行时的回归覆盖。
