---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复多个 `<style src>` 合并为同一应用样式入口时，Tailwind 后置处理覆盖用户样式的问题，确保作者 CSS 与生成的 utility 一起写入最终 `app.wxss`。
