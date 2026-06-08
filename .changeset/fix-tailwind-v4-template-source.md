---
"create-weapp-vite": patch
---

修复 Tailwind CSS 4 模板仍依赖 `tailwind.config.ts` 的 `content` 扫描范围，导致 WXML/Vue 中的 `bg-[...]` 等任意值类名只被小程序转义、但没有生成对应 WXSS 规则的问题。模板和回归用例现在在 `src/app.css` 中显式声明 `@source`，确保脚手架生成的新项目能在首轮构建和开发热更新时稳定扫描 WXML、TS 与 Vue 源码。
