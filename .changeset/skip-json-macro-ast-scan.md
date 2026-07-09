---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

在 SFC/JSX 编译中为 JSON 宏增加文本级早退，普通 `<script setup>` 和 TSX 页面不再进入不必要的 Babel 宏扫描，降低 HMR 与构建中的脚本解析开销。
