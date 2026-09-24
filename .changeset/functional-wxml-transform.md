---
"weapp-vite": minor
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

新增函数式 `weapp.wxml.transform`，支持同步、异步和顺序函数数组，并提供精确编辑最终标签及属性的 `ctx.edit` 工具。通过显式外部依赖登记支持完整模板热重建，保留现有 `remove` 配置、关键运行时元数据保护及 bundler 输出流程。

同步修正 simulator 对 WXML 属性转义和模板插值边界的解析，使转换后包含引号、反斜杠和字面量模板定界符的属性与微信开发者工具表现一致。
