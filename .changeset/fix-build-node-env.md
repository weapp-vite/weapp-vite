---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复生产构建未显式设置 `NODE_ENV` 时错误继承开发环境，确保 `process.env.NODE_ENV` 与 `import.meta.env.DEV`、`import.meta.env.PROD` 和构建模式保持一致。
