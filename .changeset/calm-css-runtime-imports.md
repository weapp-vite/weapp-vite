---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Wevu 项目开发模式与 CSS 变量编译意外依赖项目直接安装 Vue 的问题，统一从 Wevu 运行时解析 CSS 变量辅助函数，使 pnpm 严格依赖隔离下的新建项目可正常启动，并保持增删 CSS 变量时的热更新稳定。
