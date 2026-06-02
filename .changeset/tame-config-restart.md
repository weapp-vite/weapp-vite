---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下配置文件变更触发重启时，入口扫描错误被分包扫描覆盖的问题。现在重启会重新加载应用入口和分包元数据，避免使用 `app.vue` 作为应用配置来源的 wevu 模板被误报为缺少 `app.json`。
