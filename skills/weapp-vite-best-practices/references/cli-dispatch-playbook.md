# weapp-vite CLI Dispatch Playbook

## 目标

统一 `weapp-vite` 与 `weapp-ide-cli` 的命令路由：

1. `weapp-vite` 原生命令先执行。
2. 只有命中 `weapp-ide-cli` catalog 的命令才透传。
3. 未知命令不盲目透传。

## Source of truth

- 顶层命令目录维护在 `packages/weapp-ide-cli`。
- 对外导出：
  - command arrays
  - `isWeappIdeTopLevelCommand(command)`
- `packages/weapp-vite/src/cli/ide.ts` 消费这一层 API。

## 推荐实现

```ts
if (command in weappViteNativeCommands) {
  runWeappVite()
}
else if (isWeappIdeTopLevelCommand(command)) {
  runWeappIdeCliParse()
}
else {
  showUnknownCommandError()
}
```

## 细节

- `weapp-vite ide <args...>` 保持强制 passthrough 命名空间。
- 但 `weapp-vite ide logs` 是 `weapp-vite` 原生日志桥接命令。
- `close` 是 `weapp-vite` 原生命令，用于关闭微信开发者工具。
- `mcp init|print|doctor` 是 `weapp-vite` 原生命令，用于管理 AI 客户端配置。
- `help <cmd>`：
  - native command：保留 native help
  - ide command：转发给 `weapp-ide-cli`

## 验证

- native command 不会被转发
- cataloged ide command 会被转发
- unknown command 不会被转发
- `help` 对 native / ide 命令的分发正确
- 文档与 changeset 已同步
