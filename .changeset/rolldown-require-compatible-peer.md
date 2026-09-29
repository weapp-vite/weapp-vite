---
"rolldown-require": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

将 rolldown-require 的 Rolldown peer 约束与开发目录的精确 catalog 版本解耦，接受兼容的 1.x 版本，避免消费者在安装使用 Rolldown 1.2.11 的 weapp-vite 时因旧版精确 peer 约束失败。标准插件在真实构建开始后生成受管 TypeScript 支持文件，支持未执行 prepare 的干净项目直接构建。
