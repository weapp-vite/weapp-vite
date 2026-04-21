---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `config.define` 中 `import.meta.env.*` 自定义定义在 `weapp-vite` 预处理链路中丢失的问题，使 `.vue` 页面与其直接引用脚本中的成员访问行为重新与 Vite 保持一致，并补齐对应的回归测试与 issue 复现用例。
