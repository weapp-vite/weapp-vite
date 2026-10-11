---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Vue 组件与同名 TypeScript 模块共存时，导入的普通脚本被误识别为入口并生成多余根目录 chunk 的问题，统一入口解析与实际源码身份。
