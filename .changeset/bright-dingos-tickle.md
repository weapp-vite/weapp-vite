---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序 `autoImportComponents` 遇到与微信内置组件同名的本地组件时缺少明确反馈的问题。现在像 `list-view` 这类与宿主内置标签重名的组件，会在扫描阶段输出明确 warning；自动导入仍会优先使用本地组件，同时提示用户该命名会遮蔽同名内置组件，并建议参考微信官方组件文档重新命名。
