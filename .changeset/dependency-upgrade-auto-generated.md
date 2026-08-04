---
'@weapp-vite/ast': patch
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/web': patch
'@wevu/api': patch
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

升级除 TypeScript 外的依赖与 pnpm，并适配 Vite 8 的 OXC JSX 转换：已有 `esbuild.jsx: 'preserve'` 配置会同步到 OXC，避免 Wevu JSX 被误转换为 React runtime。

兼容新版 `weapp-tailwindcss` 与 `weapp-vite` 样式 sidecar 的 HMR 协作，避免 Tailwind 将虚拟样式模块 ID 当作磁盘路径读取，确保原生模板、脚本和样式增量更新正常输出。

涉及包：
- @wevu/api：dependencies.@douyin-microapp/typings
- @weapp-vite/web：dependencies.rolldown
- @weapp-vite/ast：dependencies.@oxc-project/types
- @weapp-vite/ast-native：devDependencies.@napi-rs/cli
- @weapp-vite/dashboard：devDependencies.@iconify/tailwind4
- @weapp-vite/miniprogram-automator：dependencies.ws
- rolldown-require：dependencies.get-tsconfig
- weapp-ide-cli：dependencies.execa
- weapp-vite：dependencies.@vercel/detect-agent、dependencies.rolldown-plugin-dts
- create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板
