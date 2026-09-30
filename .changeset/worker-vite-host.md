---
"weapp-vite": minor
"create-weapp-vite": patch
"@mpcore/simulator": minor
---

对齐独立 CLI、普通 Vite 和 Vite+ 的 worker 编译与开发更新，统一子目标配置、监听和原生发布，避免新增文件重复创建 watcher。mpcore 增加 worker 消息、独立模块缓存与终止能力，覆盖对应的 Node、浏览器和小程序 runtime 场景。
