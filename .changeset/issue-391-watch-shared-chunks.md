---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发态 watch 场景下主包多个入口共享模块的增量重建回归。现在当直接编辑其中一个共享入口时，`weapp-vite` 会同步发射同一 shared chunk 的其他 importer，避免原本应继续落在 `common.js` 的共享代码被错误内联进当前页面；同时补充 `github-issues` 的 issue #391 复现页与定向 watch 回归测试。
