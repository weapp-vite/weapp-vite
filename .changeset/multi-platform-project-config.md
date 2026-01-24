---
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-core/logger": patch
"rolldown-require": patch
---

新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。
补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。
避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。
