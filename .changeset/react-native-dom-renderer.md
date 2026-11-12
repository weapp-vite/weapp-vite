---
"@weapp-vite/react": minor
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/web": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"wevu": patch
"weapp-vite": minor
"create-weapp-vite": patch
---

feat(react): 增加抖音 Render Mode V2 原生 DOM renderer 配置与后端，保留 legacy 默认行为。

同步发布共享 constants 的公开直接依赖包，确保依赖范围随新增 renderer 常量一起更新。
