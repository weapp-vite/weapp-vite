---
"weapp-vite": patch
"create-weapp-vite": patch
"rolldown-require": patch
---

修复 Vue SFC 使用裸包路径的 `<style src>` 时，外部样式加载失败并将完整 SFC 源码错误送入 CSS 编译的问题；同时修复 Windows 下内存覆盖入口无法匹配 Rolldown 模块 ID，确保 `app.json.ts` 自动路由内联稳定执行。
