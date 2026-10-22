---
"@weapp-vite/tailwindcss": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 统一热更新内存编译与首次构建的 Tailwind 候选处理，避免纯脚本修改导致 rpx 字号规则换序并误触发 classic 回退；编译器产生的实际样式变化统一参与回退判断，不再依赖 watcher 回调顺序。
