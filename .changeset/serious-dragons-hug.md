---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 request globals 运行时共享产物默认输出为 `dist.js` 的命名问题，改为更语义化的 `request-globals-runtime.js`，让小程序构建产物和入口引用更容易理解与排查。
