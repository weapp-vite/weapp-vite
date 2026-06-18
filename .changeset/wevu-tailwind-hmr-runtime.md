---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 wevu + Tailwind CSS 模板开发态热更新后 `app.js` 可能残留裸 `wevu/internal-runtime` 导入的问题。现在编译产物会在写盘前统一改写到 bundler 已产出的 wevu vendor chunk，避免微信开发者工具在修改 `bg-white` 到 `bg-[red]` 等样式类后报 `module 'wevu/internal-runtime.js' is not defined`，并补充真实 DevTools HMR 回归覆盖。
