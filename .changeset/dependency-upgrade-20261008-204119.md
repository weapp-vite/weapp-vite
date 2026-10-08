---
'@mpcore/core': patch
'@mpcore/simulator': patch
'@mpcore/test': patch
'@mpcore/vitest': patch
'@mpcore/weapp-vite': patch
'@weapp-agent/cli': patch
'@weapp-core/api': patch
'@weapp-core/constants': patch
'@weapp-core/init': patch
'@weapp-core/logger': patch
'@weapp-core/schematics': patch
'@weapp-core/shared': patch
'@weapp-core/types': patch
'@weapp-vite/acceptance': patch
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

升级构建、运行时、CLI 与脚手架依赖至兼容稳定版，保持现有公开 peer 支持范围及最低运行环境。适配 Vite 新版开发样式客户端，避免浏览器 DOM 客户端进入小程序状态保持 HMR 产物；迁移 Vite、Rolldown 生命周期补丁，并移除上游已修复的 uView 条码补丁。
涉及包：
- @weapp-vite/glass-easel-web-adapter：devDependencies.playwright
- @weapp-vite/acceptance：dependencies.execa
- @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.@modelcontextprotocol/client、dependencies.@modelcontextprotocol/server、dependencies.ai、以及另外 2 项
- @weapp-vite/ast：dependencies.@oxc-project/types
- @weapp-vite/ast-native：devDependencies.@napi-rs/cli
- create-weapp-vite：dependencies.execa
- @weapp-vite/dashboard：dependencies.vue-router
- @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
- @weapp-vite/mcp：dependencies.@modelcontextprotocol/node、dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
- @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
- weapp-ide-cli：dependencies.@modelcontextprotocol/server、dependencies.cac、dependencies.execa
- weapp-vite：dependencies.@babel/preset-env、dependencies.@babel/preset-typescript、dependencies.@devframes/agentic、dependencies.@modelcontextprotocol/node、dependencies.@typescript-eslint/parser、dependencies.@weapp-tailwindcss/engine、以及另外 4 项
