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

chore(deps): 升级编译、运行时与开发工具依赖并同步脚手架版本。

本轮接受 58 个 npm 直接依赖升级目标，同步包内版本声明、默认 catalog、tailwind4 catalog 与脚手架模板，更新 Babel、Vue、Tailwind CSS、Oxc、AI SDK、Devframes、Vite+、Vitest 等编译、运行时和开发工具依赖。Rust Oxc 依赖与 JavaScript parser/types 同步到 0.157，保留原有版本前缀及公开 peer 兼容下限。

Vite+ 更新到 1.5.0，内置 Vite 8.3.5 与 Vitest 5.1.0。独立 Vite 8.3.6 未通过优化器关闭生命周期诊断，本轮保留 8.3.5；TypeScript 及其余兼容保留项继续沿用原基线。

修复内联 WXS/SJS 在 Vue SFC、Web 转换和 HMR 解析中的原始脚本保护，保留行注释、运算符与标签字面量，避免组件扫描误读脚本正文。复用统一脚本边界解析，不增加公共 API。

补齐 VS Code 扩展构建中的 WXML 源码解析依赖，缺失的模块会阻断构建，避免生成不完整的扩展包。
