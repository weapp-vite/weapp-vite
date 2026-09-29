---
'@mpcore/core': patch
'@mpcore/simulator': patch
'@mpcore/test': patch
'@mpcore/vitest': patch
'@mpcore/weapp-vite': patch
'@weapp-core/api': patch
'@weapp-core/constants': patch
'@weapp-core/init': patch
'@weapp-core/logger': patch
'@weapp-core/schematics': patch
'@weapp-core/shared': patch
'@weapp-core/types': patch
'@weapp-vite/ast': patch
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/devtools-runtime': patch
'@weapp-vite/eslint': patch
'@weapp-vite/glass-easel-web-adapter': patch
'@weapp-vite/hmr': patch
'@weapp-vite/i18n': patch
'@weapp-vite/mcp': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/qr': patch
'@weapp-vite/react': patch
'@weapp-vite/tailwindcss': patch
'@weapp-vite/volar': patch
'@weapp-vite/web': patch
'@wevu/api': patch
'@wevu/compiler': patch
'@wevu/json-render': patch
'@wevu/json-render-components': patch
'@wevu/query': patch
'@wevu/test-utils': patch
'@wevu/web-apis': patch
'create-weapp-vite': patch
'rolldown-require': patch
'vite-plugin-performance': patch
'weapp-ide-cli': patch
'weapp-vite': patch
'wevu': patch
---

自动补充依赖升级发布记录。
涉及包：
- @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
- @weapp-vite/ast：dependencies.@oxc-project/types
- @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
- @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
- @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
- weapp-ide-cli：dependencies.@modelcontextprotocol/server
- weapp-vite：dependencies.@weapp-tailwindcss/engine
- create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板
