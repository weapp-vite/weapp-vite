---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 duplicate 分包共享 chunk 在 importer 识别阶段误判自身为主包引用的问题，避免错误回退到主包后出现 `common.js` 自引用与 `rolldown-runtime.js` 相对路径异常。同时补充 issue #317 的单元与 e2e 回归覆盖，确保双分包共享模块产物稳定落在各自分包目录。
