---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下根入口脚本 HMR：当 app/plugin 根入口由 bundler 主 input 隐式产出、无需额外 emit chunk 时，仍会正确保留本轮 JS chunk 状态并写出更新后的入口文件，避免 `app.ts` 修改后 `app.js` 保持旧内容。
