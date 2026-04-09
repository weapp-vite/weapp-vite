---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite dev -o` / `weapp-vite open` 在目标项目已被微信开发者工具打开时的交互提示。现在会明确提示可按 `r` 关闭当前已打开项目并重新拉起，避免只能被动跳过重复打开；同时修复登录失效重试流程对按键结果判断不准确的问题，确保取消或超时不会被误判为继续重试。
