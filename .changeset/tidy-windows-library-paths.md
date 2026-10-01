---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一库声明构建入口与 TypeScript 配置的真实路径，修复 Windows 短路径项目生成声明失败的问题。

使标准 Vite 宿主的编译会话、子构建和侧车监听使用与宿主一致的项目根目录身份，并保留显式 preserveSymlinks 配置，避免目录别名或 Windows 短路径分裂为不同的构建路径。
