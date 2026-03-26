---
'create-weapp-vite': patch
'weapp-vite': patch
---

同步升级脚手架模板与构建链路使用的 catalog 依赖版本，包括 `weapp-tailwindcss`、`tdesign-miniprogram`、`rolldown` 与 `vite`，减少模板生成结果和仓库实际依赖之间的版本漂移。同时增强 `createProject` 的 `.gitignore` 相关测试，避免模板依赖版本正常升级后因为硬编码断言而产生误报。
