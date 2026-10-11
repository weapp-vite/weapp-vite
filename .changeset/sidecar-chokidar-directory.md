---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Chokidar 5 不支持 glob 导致原生侧车文件未被独立监听的问题。改为监听源码目录并过滤侧车类型，保留生成目录与依赖目录排除，持续发现新建文件；已登记目录仅消费 Chokidar 的稳定文件事件，避免 raw rename 回退提前或重复失效。
