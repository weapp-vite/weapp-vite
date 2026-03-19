---
'create-weapp-vite': patch
'weapp-vite-template': patch
'weapp-vite-tailwindcss-template': patch
'weapp-vite-tailwindcss-tdesign-template': patch
'weapp-vite-tailwindcss-vant-template': patch
---

为其余原生基础模板补充全原生 `layouts` 能力。相关模板现在统一使用 `src/layouts/*/index.{json,ts,wxml,scss}` 作为布局实现，并提供原生页面版的布局演示页与首页入口，不再混入 Vue 布局文件。
