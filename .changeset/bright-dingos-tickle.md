---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序 `autoImportComponents` 在组件标签名与微信内置组件重名时的自动导入行为。现在像 `list-view` 这类与宿主内置标签同名的本地组件，仍然可以在页面或模板里被正确识别并写入 `usingComponents`，避免构建产物遗漏自动导入声明。
