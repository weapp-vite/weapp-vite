---
"weapp-vite": patch
---

修复 Vue SFC 的 `<style lang="scss">` 等样式块未交给 Vite CSS 流水线处理的问题：现在会正确走 Sass 预处理与 PostCSS（含 Tailwind）等插件链，并输出对应 `.wxss`。

