---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序 `autoImportComponents` 遇到与微信内置组件同名的本地组件时缺少明确反馈的问题。现在像 `list-view` 这类与宿主内置标签重名的组件，会在扫描阶段输出明确 warning，并跳过自动导入注册，提示用户参考微信官方组件文档重新命名，避免继续生成含糊或不可预期的 `usingComponents` 结果。
