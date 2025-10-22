# 配置服务内部结构

`weapp-vite` 的配置服务现在由多个文件协同完成，目的是把职责拆分得更加清晰，便于后续迭代。

## createConfigService.ts

- 位置：`packages/weapp-vite/src/runtime/config/createConfigService.ts`
- 负责初始化配置状态、导出 `ConfigService` 对外 API，并将内部工具组合在一起。
- 统一维护 `defineEnv`、包管理器信息以及路径相关的辅助方法。

## internal/alias.ts

- 负责维护与注入内置别名，保证 `@oxc-project/runtime` 与内置依赖能被正确解析。
- 提供 `createAliasManager`，供配置加载与合并阶段复用。

## internal/loadConfig.ts

- 专注从用户工程、weapp 配置文件与默认设置中生成最终的 `InlineConfig`。
- 同时处理增强迁移、`rolldown` 插件注入以及输出后缀推导等逻辑。

## internal/merge.ts

- 抽离运行时合并逻辑，包含 `mergeWorkers`、`merge`、`mergeWeb` 与 `mergeInlineConfig`。
- 对运行平台做统一的环境标记，并复用别名处理能力。

通过以上拆分，`createConfigService.ts` 体积控制在 300 行以内，同时文档化了各模块职责，方便在需要扩展配置时快速定位到对应实现。
