# Troubleshooting

## `.weapp-vite` 支持文件缺失或过期

现象：

- 终端提示支持文件缺失或已过期
- 类型提示异常
- Volar / TypeScript 行为不一致

优先操作：

```bash
weapp-vite prepare
```

## AI 截图失败

优先检查：

1. 微信开发者工具是否已登录
2. 是否开启了「设置 -> 安全设置 -> 服务端口」
3. `--project` 是否指向真实的小程序构建目录
4. `--page` 是否为真实路由

推荐命令：

```bash
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

## 终端里看不到小程序日志

优先使用：

```bash
weapp-vite ide logs --open
```

如果 DevTools 未能自动连接，先运行 `wv ide doctor --json`。`wv open`、`wv dev -o` 和 `wv ide logs --open` 默认先通过官方 CLI 打开项目，再连接 automator；只有需要兼容旧链路时才使用 `--ide-open-strategy automator`。

`wv ide doctor` 的原生 `islogin` 查询可能拉起 IDE；只需要静态诊断时使用 `wv doctor --format json`。只读 automator 连接失败不会删除持久化会话记录。连接成功后若 `Tool.getInfo` 失败，`automator` 仍为 ok，`tool` 单独标记 warning，并释放本次连接；不能据此认定登录失效。

登录诊断仅在原生响应明确包含 `login: true/false` 时确认状态。CLI 退出成功但没有明确结果、查询超时或执行失败均标为 unknown，不再误报已登录或未登录。

如果项目启用了 `weapp.forwardConsole.enabled = 'auto'`，AI 终端场景下 `dev --open` 也可能自动附加日志桥。

## `.vue` 文件存在，但提示未安装 `wevu`

这通常意味着项目启用了 Vue SFC，但依赖侧没有满足当前约束。

优先确认：

1. 是否真的在使用 `wevu`
2. 当前项目依赖是否完整安装
3. SFC 相关写法是否应该参考 [`vue-sfc.md`](./vue-sfc.md)

## 下游验证与源码修改不一致

如果你正在修改 `packages/weapp-vite/src/**`，而验证走的是 app/template/e2e 产物，优先怀疑 `dist` 产物陈旧。

先重建：

```bash
pnpm --filter weapp-vite build
```

再做下游验证。

## IDE 恢复与窗口保留

打开项目、刷新索引或截图重试失败时，CLI 会保留现有开发者工具窗口，只重试目标项目连接；不会自动退出整个应用或按进程名终止宿主。`--no-open-recovery` 可禁用打开后的自动重试。需要真正关闭窗口时，请在 IDE 中明确选择目标项目；`wv close` 失败会返回非零退出码，不会升级为系统级退出。

## 自动化连接清理与 CDP

程序化使用 `@weapp-vite/miniprogram-automator` 或 `weapp-ide-cli` 时，`disconnect()` 返回 `Promise<void>`。同步清理回调应改为返回或 `await miniProgram.disconnect()`；调用时立即拒绝未完成 RPC 并停止订阅，Promise 等待 WebSocket 关闭。独立关闭最多等待 2 秒，超时表示关闭未确认，不能记录窗口、端口租约或快照已经释放。连接断开只影响本连接，受管窗口由持有 owner 的会话 `close()` 确认关闭；重连复用原窗口和 endpoint。

SDK 的公开 `send(method, params?, { timeout }?)` 可调用原始自动化协议。`CDP()` 提供 `enable`、`sendCommand(domain, method, params?, options?)`、`listProtocol` 和返回取消订阅函数的 `onEvent`；具体域和命令依赖目标 DevTools。headless 只适配 `Tool.getInfo`、`App.getCurrentPage/getPageStack/callFunction/callWxMethod`，CDP 和其他协议明确报告 `HEADLESS_PROTOCOL_UNSUPPORTED`，不构造真实 IDE 调试证据。

触摸脚本使用标准 `changedTouches` 字段；旧 `changeTouches` 仍兼容，同时传入时以标准字段为准。启动失败诊断会附加已脱敏的 CLI 输出尾部，截断有明确标记；结合原始 `cause` 与 `operation` 阶段、预算和清理状态定位失败。
