---
"weapp-vite": patch
---

修复 rolldown 在 CJS 输出里对页面入口的隐式 `require()` 注入，确保 `app.js` 不会抢先执行页面脚本。
