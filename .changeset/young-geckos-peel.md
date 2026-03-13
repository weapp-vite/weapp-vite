---
'create-weapp-vite': patch
'weapp-vite-template': patch
'weapp-vite-lib-template': patch
'weapp-vite-tailwindcss-template': patch
'weapp-vite-tailwindcss-vant-template': patch
'weapp-vite-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
---

统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。
