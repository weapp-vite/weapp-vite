---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一在页面 JSON 输出层保留空配置，修复无显式配置的原生页及独立分包页无法在微信开发者工具中注册导航的问题，并让 React 页面复用同一输出规则。
