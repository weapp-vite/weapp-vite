---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 使用裸包路径的 `<style src>` 时，外部样式加载失败并将完整 SFC 源码错误送入 CSS 编译的问题。
