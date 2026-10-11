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

chore(deps): 升级兼容的 AI SDK、Vue 类型工具及构建依赖，同步脚手架依赖目录和应用模板。TypeScript 保持 6.0.3，截图比较算法及既有 Vite、Rolldown 兼容补丁保持原有契约。

升级 pnpm、Bun 和 Rust JSON 序列化依赖，并迁移 repoctl 发布说明分类补丁；沿用上游已有的发布 PR 去重修复。
