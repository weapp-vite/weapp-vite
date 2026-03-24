---
"create-weapp-vite": patch
---

统一仓库内小程序项目 `project.private.config.json` 的默认 `libVersion` 为 `3.15.0`。新增同步脚本集中维护该默认值，并让模板与 DevTools 自动化使用同一处配置来源，减少不同项目与产物之间的版本漂移。
