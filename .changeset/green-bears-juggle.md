---
'weapp-vite': patch
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

为 `weapp-vite` 增加开发态输出目录清理开关 `weapp.cleanOutputsInDev`，并将开发态默认行为调整为“不在 `dev` / `dev -o` 启动前全量清空小程序输出目录”。这样模板和项目在默认配置下即可减少开发模式的磁盘清理开销；如果需要恢复旧行为，可显式设置 `cleanOutputsInDev: true`。 
