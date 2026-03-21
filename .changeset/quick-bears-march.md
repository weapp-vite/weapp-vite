---
'weapp-vite': patch
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

修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。
