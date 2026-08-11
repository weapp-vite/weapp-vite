---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 CLI 构建模式与外部 `NODE_ENV` 冲突时环境变量错误的问题，确保 `process.env.NODE_ENV` 与 `import.meta.env.DEV`、`import.meta.env.PROD` 和命令模式保持一致。
