---
"create-weapp-vite": patch
---

修复 `create-weapp-vite` 官方模板在 Node.js 20 下通过 npm、pnpm、yarn 安装时，可能因为 ESLint React 生态依赖漂移到仅支持 Node.js 22+ 的版本而导致安装失败的问题。现在模板会显式锁定兼容 Node.js 20 的 `@eslint-react/eslint-plugin` 版本，避免跨平台 smoke 和真实用户初始化项目时被上游依赖变更击穿。
