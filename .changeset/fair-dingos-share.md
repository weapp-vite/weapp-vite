---
'@weapp-vite/volar': patch
---

修复 `weapp-vite/volar` 在 Vue SFC 模板中对 `<wxs module="...">` 的类型识别问题。现在当模板通过 `phoneReg.xxx()` 这类方式访问 WXS 模块时，IDE 不再错误提示 “属性不存在于模板上下文”，从而让小程序合法写法与编辑器类型体验保持一致。
