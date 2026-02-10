---
'weapp-vite': minor
'@wevu/compiler': minor
'create-weapp-vite': patch
---

将 Vue 模板 `:class` / `:style` 的默认运行时从 `auto` 调整为 `js`，减少“WXS 模式下表达式级回退到 JS”带来的行为分岔，提升不同表达式形态下的一致性与可预期性。

同时保留 `auto` / `wxs` 可选策略：

- `auto` 仍会在平台支持 WXS 时优先使用 WXS，否则回退 JS。
- `wxs` 在平台不支持时仍会回退 JS 并输出告警。

更新了对应的配置类型注释与文档示例，明确默认值为 `js`。
