---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `autoImportComponents` 在搭配 `VantResolver` 等大型 resolver 时默认全量产出 resolver 组件支持文件的问题。现在仅会为模板里实际命中的 resolver 组件生成 manifest、typed components 与 Vue 编辑器声明，同时 `prepare`/支持文件同步阶段也会扫描 `.vue`、`.wxml` 模板以补齐真实使用到的组件，减少大型组件库带来的编译与支持文件生成开销。
