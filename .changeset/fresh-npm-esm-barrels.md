---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复小程序 npm 包中压缩形式的 ESM 导入与 `export *` 桶文件未转换为 CommonJS 的问题，避免新版微信开发者工具加载组件依赖时出现裸 `export` 语法错误。
