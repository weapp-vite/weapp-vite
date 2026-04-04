---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp-vite` 在处理 `<wxs src="./foo.wxs.ts">` 等脚本模块依赖时，会把 `.wxs/.sjs` 文件错误加入模板发射队列的问题。现在构建产物不再生成内容为脚本却后缀为 `.wxml` 的异常文件，例如 `index.wxs.wxml`、`bbc.wxml`、`esm.wxml`。
