---
"weapp-vite": patch
"create-weapp-vite": patch
"rolldown-require": patch
---

修复 Vue SFC 使用裸包路径的 `<style src>` 时，外部样式加载失败并将完整 SFC 源码错误送入 CSS 编译的问题；同时修复 Windows 下 CJS 外部依赖绝对路径中的反斜杠被错误转义，确保 `app.json.ts` 脚本配置可以稳定加载依赖。
