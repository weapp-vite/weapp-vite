---
'create-weapp-vite': patch
---

修复脚手架模板仍然导入 `@wevu/api` 的问题，统一改为使用 `wevu/api` 子路径入口，并移除 lib 模板里不再需要的 `@wevu/api` 直接依赖，避免新建模板项目在构建时出现导入解析失败。
