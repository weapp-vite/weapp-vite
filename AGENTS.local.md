# 本地工程约束

- GitHub issue 或 runtime 回归优先在 `.codex-tmp/<issue>` 隔离 worktree 中处理；先建立最小复现，再定位根因，最后修改源码。
- 修改 `packages/*/src/**` 或 `packages-runtime/*/src/**` 后，运行下游 app、headless 或 IDE 验证前必须先重建受影响 package 的 `dist`。
- 任何 E2E 入口都全局串行运行。启动前清理残留 DevTools、automator、dev-watch 和验证 server 进程；发现问题时可先用 `--allow-failures`，最终验收必须使用严格模式。
- 先用 headless/provider-compatible runtime 缩小问题，真实 WeChat DevTools 的可观察结果是最终验收标准。记录能力探针、协议或端口限制，不能把基础设施失败写成产品通过。
- bundle 断言只匹配稳定运行语义：扫描实际 emitted JS、公开 marker、相对路径和对象结构；不要绑定 `common.js`、hash、压缩变量名或内部 helper 名。
- 构建产物持久化必须由 Vite/Rolldown emit/write 负责，不得使用手写 `writeFile` 绕过构建所有权。
- Issue 修复交付门槛：必须先在 `e2e-apps/github-issues` 或等价 fixture 中沉淀用户报告场景，再以 headless runtime E2E 的可观察结果作为修复是否成立的最终判据；单测、typecheck、构建只能作为辅助证据。
- 每个 Issue 修复至少覆盖用户主路径及一个关键边界，并同步检查构建产物路径/文件存在性；若真实 IDE 可用，还必须运行对应 DevTools runtime 场景并记录与 headless 的一致性。
- 若 E2E 因 IDE、端口或 automator 基础设施不可用而无法运行，必须在 PR 中明确记录环境限制、保留可运行的替代覆盖，并不得宣称“已完成 runtime 验收”。
