---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 request globals 安装器内联到 app 注册模块后，ESM 页面入口和 app.prelude 仍可能引用已删除 runtime chunk 的问题，并收窄 app.json 归一化范围，避免 sitemap 等旁路 JSON 被误当作 app 配置处理。

修复 HMR 局部重建共享 chunk 时只重写当前脏入口，导致已发出的旧入口仍引用共享 chunk 旧导出契约的问题；现在会按共享 chunk 的稳定 importer 关系扩展直接脏入口，并保持共享 chunk 导出名语义稳定，避免依赖 `Ma`/`na` 这类压缩后的临时导出名。
