---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复小程序独立模板与脚本模块文件的热更新依赖传播。现在当被多个 WXML 或 Vue 页面通过 `import`、`include`、`wxs` 等方式引用的共享 `.wxml`、`.html`、`.wxs`、`.sjs` 文件发生保存时，所有引用方都会被正确标记并重新生成，避免共享模板持续演进后热更新失效。
