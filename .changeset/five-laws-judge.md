---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态增量构建里跨主包与分包共享 chunk 的入口补发策略。当 direct update 命中这种跨包共享模块时，HMR 现在会把同组入口一起重编，避免 shared chunk 落点漂移后出现 `node_modules/wevu/dist/index.js` 未定义、分包 runtime 失配等运行时报错。
