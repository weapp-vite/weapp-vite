---
"@weapp-vite/miniprogram-automator": patch
"@weapp-vite/devtools-runtime": patch
"weapp-ide-cli": patch
"weapp-vite-wevu-tailwindcss-tdesign-template": patch
"create-weapp-vite": patch
---

修复 DevTools 自动化会话生命周期与截图恢复逻辑，为 wevu + Tailwind CSS + TDesign 模板补充稳定选择器，并把真实 IDE 打开、截图、DOM 操作与登录失效诊断流程纳入 e2e 覆盖。
