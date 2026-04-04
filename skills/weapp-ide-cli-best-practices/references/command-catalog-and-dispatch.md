# weapp-ide-cli Command Catalog And Dispatch

## 目标

使用单一 source-of-truth 管理 CLI 命令目录，并暴露给上游 delegator 使用。

## 推荐结构

在 `packages/weapp-ide-cli/src/cli/command-catalog.ts` 导出：

- `WECHAT_CLI_COMMAND_NAMES`
- `AUTOMATOR_COMMAND_NAMES`
- `MINIDEV_NAMESPACE_COMMAND_NAMES`
- `CONFIG_COMMAND_NAME`
- `WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES`
- `isWeappIdeTopLevelCommand(command)`

## weapp-ide-cli 内部分发顺序

1. 解析 locale 并配置语言。
2. 路由 `minidev` 命名空间。
3. 路由 automator 命令。
4. 处理 automator `help`。
5. 处理 `config` 子命令。
6. 最后执行官方 WeChat CLI passthrough。

## 上游 CLI 分发顺序

对 `weapp-vite` 或其他 wrapper：

1. 先运行 wrapper 原生命令。
2. 仅当命中 `isWeappIdeTopLevelCommand` 时才透传。
3. 不要盲目透传未知命令。

## 最小测试矩阵

- catalog 覆盖全部命令组。
- `isWeappIdeTopLevelCommand` 对已知命令返回 `true`。
- 上游 wrapper 不透传原生命令。
- 上游 wrapper 能透传 catalog 命令。
- 上游 wrapper 会拒绝未知命令。
