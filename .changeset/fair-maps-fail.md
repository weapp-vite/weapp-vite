---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 wevu 页面通过本地 helper 间接注册 `onPullDownRefresh`、`onReachBottom` 时，`weapp-vite` 漏掉页面特性注入，导致下拉刷新与触底钩子在最终产物中不生效的问题。
