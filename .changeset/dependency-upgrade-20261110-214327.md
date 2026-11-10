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
'@weapp-vite/language-service': patch
'@weapp-vite/mcp': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/oxfmt': patch
'@weapp-vite/oxlint': patch
'@weapp-vite/qr': patch
'@weapp-vite/react': patch
'@weapp-vite/tailwindcss': patch
'@weapp-vite/volar': patch
'@weapp-vite/web': patch
'@weapp-vite/wxml': patch
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

chore(deps): 升级 AST、构建声明、脚手架和请求传输依赖。

同步 Oxc JS 类型与可选 Rust 分析器至 0.158.0，更新 oxfmt 0.78.0、ignore 7.0.14、ws 8.22.2、dotenv 18.0.10 和 rolldown-plugin-dts 0.30.1。保留现有公开 API、类型契约及 native 的 JS fallback。

声明构建改用 rolldown-plugin-dts 的 `dtsOnly`，消除默认构建中的弃用告警，保持声明产物契约。
