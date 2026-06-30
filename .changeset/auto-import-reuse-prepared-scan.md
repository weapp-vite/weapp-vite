---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化自动导入启动路径。`createCompilerContext` 在同步支持文件时完成的自动导入组件扫描，会被后续 Vite 插件初始构建复用，避免开发启动和构建阶段对同一批组件 globs 重复扫描与注册。
