---
"create-weapp-vite": patch
"weapp-vite": patch
---

新增可按需启用的内置 `weapp-tailwindcss` 集成。通过 `weapp.tailwindcss` 传入 `true` 或 core options，即可在不注册额外 Vite 插件的情况下生成 Tailwind 样式并完成小程序运行时兼容转换；默认保持关闭。
