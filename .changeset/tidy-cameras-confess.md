---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复独立分包构建时 `import.meta.env` 分包内联定义未正确参与静态替换的问题，避免子包页面产物把预期常量编译成 `undefined`。同时修正相关 fixture 测试工程的工作区包链接方式，确保 `pnpm test` 可以稳定加载 `weapp-vite` 配置并通过回归测试。
