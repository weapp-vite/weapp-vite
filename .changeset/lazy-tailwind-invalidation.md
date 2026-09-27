---
"weapp-vite": patch
"create-weapp-vite": patch
---

避免未使用 Tailwind CSS 的项目在首次文件更新时为失效空缓存而初始化编译器，保留已启用 Tailwind 的文件失效、样式脏标记及删除处理。
