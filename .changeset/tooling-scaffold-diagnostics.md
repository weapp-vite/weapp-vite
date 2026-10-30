---
"weapp-vite": patch
"@mpcore/simulator": patch
"create-weapp-vite": patch
---

fix(tooling): 改善构建诊断和脚手架依赖配置。

开发、生产构建及保留模块的拆包分组提供可读计时标签，消除 Rolldown 关于缺少 `debugName` 的告警。

修复诊断脚本在严格 TypeScript 检查下的类型错误，并明确 simulator 浏览器工具链使用的配置，避免无关应用的配置尚未准备时导致 Vue 转换失败。

同步脚手架模板的 `@vue/shared` 依赖映射，让模板依赖清单与工作区配置保持一致。
