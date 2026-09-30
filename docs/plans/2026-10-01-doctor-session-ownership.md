# Doctor 只读连接与会话所有权

本次从主线提交 `933498a19c694bf1256650297e1a55283123c189` 复现两处独立于宿主登录的缺陷，作为 #1074 的局部修复，不代表完整诊断验收。

- `connectOpenedAutomator` 在连接失败后按项目键删除持久化记录。连接超时不能证明记录已失效；并发操作可能已替换记录。只读连接没有删除权限，失败应保留记录与原始错误。
- `wv ide doctor` 把连接和 `Tool.getInfo` 放在同一错误边界，工具信息读取失败会覆盖已连接事实，并跳过 disconnect。将信息查询独立处理，在 finally 释放本次连接。

回归覆盖临时失败后重新连接、失败期间记录被替换、损坏记录不清理，以及工具查询失败时连接事实与 disconnect 次数。初始定向测试 3 项失败、16 项通过；修复后 19 项通过。关联测试还发现旧的“失败即删除”契约，随行为变化一并更新。

会话修复不改变既有 API 签名、不新增宿主关闭。下文追加的登录查询是独立的显式 API，原透传方法保持兼容；监听器身份、分层失败证据与脱敏诊断包仍需独立完成。

真实稳定版共享宿主验收尚未完成：Computer Use 返回 Mac 锁定，未启动新 IDE 测试、未绕过登录或解锁。后续在安全 E2E 清理代码到位、机器空闲且解锁后，核对官方最新稳定版并验证目标连接释放、原宿主和其他项目保留。通过前保持草稿，不关闭 #1074。

既有 automator 与 IDE 命令文件已超过 300 行。本次删除错误清理并调整局部生命周期边界，避免在修复中混入整个命令模块拆分；新增回归保持独立文件。

## 本轮验证范围

- `pnpm vitest run packages/weapp-ide-cli/test/automator-persistence.test.ts packages/weapp-ide-cli/test/automator.test.ts packages/weapp-ide-cli/test/automator-session.test.ts packages/weapp-vite/src/cli/commands/ide.test.ts packages/weapp-vite/src/doctor/index.test.ts`：74 项通过。
- 两个包的 `typecheck`、`build` 与现有公开类型检查通过；测试 mock 的 Node 类型错误修正后重新验证。
- 定向 ESLint、changeset 联动检查与 website 构建通过。公开文档同步说明旧 IDE Doctor 会调用原生 `islogin`，不能承诺原生 CLI 不拉起宿主；静态诊断使用 `wv doctor`。
- 本轮回归是 mock 单测，未启动真实 IDE；不作为 runtime 通过证据。


## 登录事实与命令结果

原生 `islogin` 在 stdout 返回 JSON；旧透传方法返回 void，Doctor 却把 Promise 完成当成已登录，并把任何异常当成未登录。新增显式 CLI 的 `queryWechatIdeLogin`：不经过配置重解析、bootstrap 或交互重试，使用有界进程超时，严格采信 JSON 布尔值；空输出、非布尔值、矛盾响应、超时和命令失败均保留 unknown，不附带原始错误或输出。原 CLI 透传 API 保持兼容。默认静态 Doctor 不调用此方法；原生查询可能启动 IDE，文档明确该边界。

Doctor 三个最小回归在旧实现均误报 ok，原 3 失败 / 16 通过；新增查询解析、失败与 timeout 参数回归及 tsd 契约。该改动补齐登录事实区分，但不构成监听器身份、实际宿主版本或整个 #1074 分层证据包完成。

追加登录语义后，关联 6 文件共 89 项通过；新增公共类型 tsd、两包 typecheck/build、website 构建和定向 ESLint 通过。真实原生 CLI 登录查询尚未验收，不将 mock 响应作为实际登录状态。
