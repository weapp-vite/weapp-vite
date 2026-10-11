---
"weapp-vite": patch
"create-weapp-vite": patch
---

开发模式的一次性编译快照不再创建常驻侧车监听，目录监听只由持续开发宿主或监听构建持有，同时保留原生配置和模板的构建依赖声明。
