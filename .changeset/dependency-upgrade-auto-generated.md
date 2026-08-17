---
'@mpcore/weapp-vite': patch
'@weapp-vite/ast': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

升级工作区非 TypeScript 依赖并同步公共包的发布意图，覆盖 SWC、Vue tooling、Tailwind CSS、dayjs 等版本；同时兼容 SWC 1.16 函数体 AST 结构和 weapp-tailwindcss 5.3 的 Skyline 样式入口。
