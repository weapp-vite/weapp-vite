# 本地工程约束

- GitHub issue 或 runtime 回归优先在 `.codex-tmp/<issue>` 隔离 worktree 中处理；先建立最小复现，再定位根因，最后修改源码。
- 修改 `packages/*/src/**` 或 `packages-runtime/*/src/**` 后，运行下游 app、headless 或 IDE 验证前必须先重建受影响 package 的 `dist`。
- 任何 E2E 入口都全局串行运行。启动前清理残留 DevTools、automator、dev-watch 和验证 server 进程；发现问题时可先用 `--allow-failures`，最终验收必须使用严格模式。
- 先用 headless/provider-compatible runtime 缩小问题，真实 WeChat DevTools 的可观察结果是最终验收标准。记录能力探针、协议或端口限制，不能把基础设施失败写成产品通过。
- bundle 断言只匹配稳定运行语义：扫描实际 emitted JS、公开 marker、相对路径和对象结构；不要绑定 `common.js`、hash、压缩变量名或内部 helper 名。
- 构建产物持久化必须由 Vite/Rolldown emit/write 负责，不得使用手写 `writeFile` 绕过构建所有权。
