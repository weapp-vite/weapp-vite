---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp-vite` 对 `src/assets` 下已被 `import` 等模块链路处理的图片重复执行静态资源扫描复制的问题，避免同一张图片同时输出原路径文件和哈希文件，并同步更新 `create-weapp-vite` 的版本联动发布。
