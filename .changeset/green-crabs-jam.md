---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 dev / HMR 场景下 shared chunk importer 的增量刷新丢失问题。现在当 partial emit 没把未变化的 shared chunk 一起带进当前 bundle 时，会保留已有 importer 关联，不再先删后丢，避免后续页面、layout、组件在连续热更新后失去 shared runtime 的联动重编译，导致小程序模拟器偶发出现 `** is not a function`、运行时 helper 缺失或相关 chunk 引用失配。
