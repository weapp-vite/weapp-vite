---
"@weapp-vite/vscode": patch
---

为 VS Code 扩展补充安装态 `.vsix` 真实宿主 e2e 校验，修复发布产物在真实 VS Code 宿主中因 `vscode` 导入形态不兼容而导致的激活失败问题，并补充 `.vscode-test` 产物忽略规则。
