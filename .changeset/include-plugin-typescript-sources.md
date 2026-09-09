---
"weapp-vite": patch
"create-weapp-vite": patch
---

托管 TypeScript 配置现在默认包含已配置的插件源码目录，并保留用户声明的 include 和 exclude。插件模板同步声明共享源码目录，避免插件编译错误加载父工作区中无关项目的 TypeScript 配置。
