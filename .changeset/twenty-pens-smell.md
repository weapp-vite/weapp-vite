---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `app.json.ts` 中直接 `import 'weapp-vite/auto-routes'` 时的构建失败问题。现在会在执行脚本化 app 配置前内联当前的自动路由快照，并兼容 `rolldown-require` 返回非 `default` 导出的结果，确保 `pages` 与 `subPackages` 可正常写入最终 `app.json`。
