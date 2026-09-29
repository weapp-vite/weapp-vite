---
"rolldown-require": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

联动发布 rolldown-require，将发布包的 Rolldown peer 约束同步到工作区已验证的 1.2.11，避免消费者严格安装当前 weapp-vite 时仍解析到要求旧版引擎的适配包。标准插件在真实构建开始后生成受管 TypeScript 支持文件，支持未执行 prepare 的干净项目直接构建。
