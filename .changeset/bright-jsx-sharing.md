---
'@wevu/compiler': patch
'@weapp-core/constants': patch
'create-weapp-vite': patch
'wevu': patch
---

支持从相邻 JSX/TSX 模块导入并复用静态 JSX 片段、JSX 工厂函数以及经过 barrel 文件 re-export 的 JSX 片段。编译器升级到 `@vue/babel-plugin-jsx 3.0.0`，在生成 WXML 前完成静态分析，并将无法静态映射的闭包、model、slot、spread 和动态组件交给结构化 Wevu island runtime；Vue SFC 的 `<script setup lang="js|ts|jsx|tsx">` 与普通 JSX/TSX script 也进入同一编译流程。
