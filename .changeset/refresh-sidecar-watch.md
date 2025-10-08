---
'weapp-vite': patch
---

修复在新增或删除 JSON/JSON.ts/JSONC 以及 WXSS 等 sidecar 文件时热更新失效的问题，通过触发所属脚本的重新构建，并补充相关单元测试覆盖 watcher 行为。
