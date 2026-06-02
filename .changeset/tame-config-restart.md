---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下配置文件变更触发重启时，入口扫描错误被分包扫描覆盖的问题。现在重启会重新加载应用入口和分包元数据，并保持 `app.vue`、`app.ts` 搭配 `app.json.ts` 等入口配置组合的扫描结果，避免被误报为缺少 `app.json`。
