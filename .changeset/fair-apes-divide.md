---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复本地分包从共享 `miniprogram_npm` 缓存复制 npm 产物时的稳定性问题。现在 `weapp-vite` 在按依赖过滤复制独立分包 npm 文件时会使用受控的目录遍历复制，避免 `tdesign-miniprogram/transition/*` 这类深层文件在构建阶段偶发 `ENOENT`，恢复 GitHub issue 分包场景和相关 CI e2e 的稳定通过。
