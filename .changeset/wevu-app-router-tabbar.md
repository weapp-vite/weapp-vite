---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu/router` 在 App setup 中创建实例失败，以及未传入 `tabBarEntries` 时把 tabBar 页走成 `redirectTo` 的问题。
