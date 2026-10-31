---
"@weapp-vite/ast": patch
"@weapp-vite/miniprogram-automator": patch
"@weapp-vite/tailwindcss": patch
---

fix(types): 随包安装公开声明所需的第三方类型，修复独立 TypeScript 消费者无法解析 convert-source-map、ws 和 set-value 声明的问题。
