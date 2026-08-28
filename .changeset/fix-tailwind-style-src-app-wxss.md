---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复同一入口由多个 `<style src>` 产生多个 CSS asset 时分别写入同名 wxss、导致后写样式覆盖前写样式的问题；现在按最终 owner 样式文件稳定归组并合并片段，再统一注入共享样式和写出 `app.wxss`。
