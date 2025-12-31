---
'weapp-vite': patch
---

修复 `<script setup>` 中 `defineExpose` 的编译产物处理：不再错误移除 `__expose({ ... })`，并将其对齐为 wevu `setup(_, { expose })` 的 `expose(...)` 调用，确保公开成员可被正确暴露。
