---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp-vite` 在开发模式热更新时重复 emit 资源的问题，避免模板项目在修改 `.wxml` 等文件后出现大量 `[FILE_NAME_CONFLICT]` warning，并同步更新 `create-weapp-vite` 的版本联动发布。
