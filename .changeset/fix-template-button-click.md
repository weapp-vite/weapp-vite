---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 首页按钮点击时使用内联表达式更新 `count` 触发的运行时报错，改为显式方法处理点击事件。
