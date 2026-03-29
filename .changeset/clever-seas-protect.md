---
'create-weapp-vite': patch
'weapp-vite-template': patch
'weapp-vite-lib-template': patch
'weapp-vite-tailwindcss-template': patch
'weapp-vite-tailwindcss-tdesign-template': patch
'weapp-vite-tailwindcss-vant-template': patch
'weapp-vite-wevu-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

将脚手架生成项目中的 `AGENTS.md` 改为由 `create-weapp-vite` 统一动态生成，不再在各模板目录中重复维护近似副本。新的 AGENTS 指引会集中补充 `weapp-vite` 的 CLI / prepare / screenshot / ide logs 用法、`wevu` 模板的运行时编写约束，以及推荐安装的 AI skills 列表，降低后续模板间文案漂移和维护成本。
