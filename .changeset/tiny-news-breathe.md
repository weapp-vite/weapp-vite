---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `app.json.ts` 中从 `weapp-vite/auto-routes` 使用具名导入时 `pages` 与 `subPackages` 未正确内联的问题。
