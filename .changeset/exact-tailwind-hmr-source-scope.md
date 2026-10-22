---
"@weapp-vite/tailwindcss": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 保持 Tailwind 热更新与首次构建的扫描范围一致，避免纯脚本保存时扫描配置范围外的文件、额外生成样式并误触发 classic 回退。
