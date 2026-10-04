---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下配置依赖变化可能触发重复重启的问题，由 Vite 宿主统一监听和重载配置，避免同一次修改重复执行配置文件。
