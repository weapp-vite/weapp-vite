---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发态 HMR 在页面编辑后可能遗漏 layout 和组件 shared chunk importer 的增量重建问题。现在当页面改动触发共享 chunk 重新生成时，`weapp-vite` 会一并重新发射同一 shared chunk 的 layout/component importer，避免 `onMounted` 等共享导出别名变化后仍被旧组件 chunk 继续引用，导致热更新后页面在 attached 阶段崩溃；同时补充 `github-issues` 的 issue #398 最小复现页与定向 watch 回归测试。
