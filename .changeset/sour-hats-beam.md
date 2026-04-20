---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `tdesign-miniprogram/*` 通过 TypeScript alias 指向 `node_modules/.../miniprogram_dist/*` 时的小程序 npm 本地化兼容问题。`weapp-vite` 现在会把 alias 展开的绝对 `node_modules` 文件路径还原成稳定的 npm specifier，再继续走分包 `miniprogram_npm` 重写逻辑，避免 `Dialog.confirm` 这类命令式 API 在产物里落成错误的双层 `default` 访问或错误的 `miniprogram_dist` 路径。
