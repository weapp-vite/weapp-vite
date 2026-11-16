---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 状态保持 HMR 只保留模板和样式产物的内容指纹，避免缓存完整编译产物导致首次 HMR 内存占用异常增长。
