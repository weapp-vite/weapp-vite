# IDE Command Playbook

## 命令所有权

1. `weapp-vite` 原生命令先执行。
2. 只有命中 `weapp-ide-cli` catalog 的顶层命令才透传。
3. 未知命令不要盲目 passthrough。

## 重点命令与边界

- `preview`
- `upload`
- `config`
- `screenshot`
- `compare`
- `ide logs`
- `close`
- `mcp init|print|doctor`

## 契约要点

- `screenshot` / `compare` 的文件输出路径与 `--json` 结构保持稳定。
- `compare` 失败时返回非零退出码。
- `ide logs` 的持续监听与退出行为要可预测。
- `mcp init|print|doctor` 的客户端名称、transport 与写入确认行为要和 CLI 实现一致。
- `wv` 与 `weapp-vite` 示例口径保持一致。
