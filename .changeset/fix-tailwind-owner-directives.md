---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 Vue SFC 多样式入口与 weapp-tailwindcss 同时使用时，Tailwind 配置指令被重复补写到最终 `app.wxss` 的问题，确保最终小程序样式只包含已生成的合法 WXSS。
