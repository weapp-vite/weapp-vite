---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 auto-routes 在开发模式下对新增页面与目录变更的热更新同步问题：补齐 pages 相关路径变更的兜底重扫逻辑，并修正全量重扫时的候选扫描范围，避免 typed-router 与构建产物在增删改场景下出现漏更新。同步新增并加固 auto-routes HMR 的 e2e 覆盖，验证新增、删除、修改、重建等核心路径。
