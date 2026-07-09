---
"weapp-vite": patch
"@weapp-vite/miniprogram-automator": patch
"weapp-ide-cli": patch
"@weapp-vite/mcp": patch
---

增强 DevTools 真实运行时 e2e 与 automator 稳定性，补齐页面真实 DOM/状态验收，降低 request globals 场景的 setData 传输体积，并保持 native AST / runtime 加速路径在无 native binding 时可回退运行。
