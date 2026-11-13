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
'@weapp-vite/vscode': patch
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

chore(deps): 升级 AI SDK、Babel、Vue 插件、通信依赖及构建工具，并同步工作区 catalog 和 create-weapp-vite 内置模板数据。

weapp-vite 使用 Babel 8.1.2 与 rolldown-plugin-dts 0.30.2；automator 使用 ws 8.23.0，VS Code 扩展同步 1.146.0 类型声明。迁移 plugin-vue 6.0.11 的 Oxc 上下文补丁，并刷新父依赖允许范围内的 @hono/node-server 至 2.1.8，消除两条新增安全通告。

验证默认环境更新为 Node 26.13.1 与 Rust 1.100.0，保留公开 Node 支持下限；Node 支持矩阵补齐 latest-26 并修复 Node 24 selector 与默认版本的耦合。TypeScript、local-pkg 和 Vite/Rolldown/Vite+ 保留已验证组合，兼容性决策见本轮升级记录。
