---
"weapp-vite": minor
"create-weapp-vite": patch
---

标准 Vite/Vite+ 插件支持六平台单目标原生与 Vue 构建、classic 开发和生产 watch。三入口均可通过顶层平台配置选择目标，平台项目配置使用原生引擎发布并保护小程序输出目录。

修复支付宝插件生产 npm 目录名称和抖音、百度、京东、小红书独立 CLI 多平台模式的默认 npm 输出根，避免依赖发布到错误目录。
