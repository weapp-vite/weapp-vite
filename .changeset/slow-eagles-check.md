---
'weapp-vite': patch
---

修复 weapp 项目中 Vue SFC 内联样式依赖变更后未及时触发 HMR 刷新的问题，确保 `@import` 和 `src` 引入的样式修改能够正确更新对应页面产物。
