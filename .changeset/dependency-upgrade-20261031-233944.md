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

chore(deps): 自动补充依赖升级发布记录。
涉及包：
- @weapp-core/types：devDependencies.tsdown
- @weapp-vite/glass-easel-web-adapter：devDependencies.tsdown
- @wevu/web-apis：devDependencies.eventsource-parser
- @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.ai、devDependencies.tsdown
- @weapp-vite/ast：dependencies.@oxc-project/types
- create-weapp-vite：dependencies.@inquirer/prompts
- @weapp-vite/dashboard：dependencies.@devframes/agentic、dependencies.@devframes/hub、dependencies.@devframes/hub-ui
- @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
- @weapp-vite/miniprogram-automator：dependencies.ws
- weapp-vite：dependencies.@typescript-eslint/parser、dependencies.rolldown-plugin-dts、devDependencies.@devframes/agentic、devDependencies.@devframes/hub、devDependencies.@devframes/hub-ui、optionalDependencies.@swc/core

chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @icebreakers/eslint-config, @types/node, @vue/language-core, autoprefixer, axios, devframe, eslint, magic-string, oxc-parser, postcss, rolldown, sass, sass-embedded, tailwind-variants, tslib, uview-plus, vue-tsc。命名 catalog 变更键：无。

迁移 rolldown-plugin-dts 0.29 的 tsc 配置命名空间，兼容旧顶层配置，保留项目引用、上下文隔离和 Vue 声明生成契约。Rust N-API 与 Oxc 配套升级，保留可选原生路径及 JavaScript fallback；SSE 与样式变体由回归覆盖。TypeScript 保留 6.0.3，Node 支持范围不变。

修复 classic HMR 的来源证明：React 普通 JSX/TSX 在转换前记录实际输入，原生入口继续由 raw reader 独占；保存事件以 Vite 同次稳定读取结算摘要，避免文件截断阶段污染恢复版本，并保留晚到读取、后续保存和关闭之间的所有权隔离。
