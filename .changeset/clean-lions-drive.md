---
"weapp-vite": minor
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

- 新增共享 chunk 的配置能力，并在构建阶段仅使用 rolldown（忽略 rollupOptions）。
- web 插件在未扫描模板列表时也可直接转换 wxml。
