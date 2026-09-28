---
'@weapp-vite/ast': patch
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/glass-easel-web-adapter': patch
'@weapp-vite/mcp': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/qr': patch
'@weapp-vite/tailwindcss': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-ide-cli': patch
'weapp-vite': patch
'wevu': patch
---

升级 Vite、Rolldown、Tailwind 构建链及 Dashboard、MCP、自动化工具的相关依赖，保持共享依赖版本一致，并同步脚手架模板使用的依赖 catalog。迁移 uview-plus 3.8.125 兼容补丁，仅保留条码实例 $nextTick 等待。保留 TypeScript 6 与现有环境变量展开语义。
