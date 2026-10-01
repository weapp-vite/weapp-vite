# Doctor 只读连接与会话所有权

本次从主线提交 `933498a19c694bf1256650297e1a55283123c189` 复现两处独立于宿主登录的缺陷，作为 #1074 的局部修复，不代表完整诊断验收。

- `connectOpenedAutomator` 在连接失败后按项目键删除持久化记录。连接超时不能证明记录已失效；并发操作可能已替换记录。只读连接没有删除权限，失败应保留记录与原始错误。
- `wv ide doctor` 把连接和 `Tool.getInfo` 放在同一错误边界，工具信息读取失败会覆盖已连接事实，并跳过 disconnect。将信息查询独立处理，在 finally 释放本次连接。

回归覆盖临时失败后重新连接、失败期间记录被替换、损坏记录不清理，以及工具查询失败时连接事实与 disconnect 次数。初始定向测试 3 项失败、16 项通过；修复后 19 项通过。关联测试还发现旧的“失败即删除”契约，随行为变化一并更新。

会话修复不改变既有 API 签名、不新增宿主关闭。下文追加的登录查询是独立的显式 API，原透传方法保持兼容；共享 Doctor 分层事实与脱敏报告的实现和验证见文末。TCP 监听事实不证明监听器身份。

初轮真实稳定版共享宿主验收因 Mac 锁定未完成，未绕过登录或解锁；后续解锁后的实测范围见文末。通过全部门槛前保持草稿，不关闭 #1074。

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


## 共享 Doctor 分层事实

运行探针现分别记录 CLI 可执行条件、显式 TCP 服务监听、登录查询和登录状态、连接、工具与当前页面、连接释放。原生登录查询单独显式选择，默认 runtime 仍不启动 IDE。CLI 与服务端口必须由调用方明确供给，缺失为 not-run，不从另一安装或端口猜测。监听身份未知，错误责任保留 unknown。

JSON/SARIF/终端保留部分成功事实。证据包只包含版本白名单、布尔配置摘要、固定分类事件、最后成功阶段和带占位符的复现命令；不透传 Tool.getInfo、查询输出、凭据、路径或路由参数。迟到 RPC 不修改完成快照，迟到连接仅释放其自身 websocket。原四个最小回归全部失败，修改后通过；又补充了连接/RPC 超时、未执行登录、端口保留与失败页面断言的覆盖。

新增 CLI、程序化 API 和 tsd；真实宿主尚待最新稳定版验收。该分层快照不等于 #1141 的跨进程总 deadline，也不把业务页面快照当完整功能验证。

分层实现提交 `28f48d23117276a257be0c9fcfd32d51cf76e7a9` 提交前，关联 7 文件 103 项测试、weapp-vite typecheck、完整公开类型检查、构建和定向 ESLint 通过；网站构建及 changeset 联动检查通过。证据明确区分实际 IDE 和基础库版本，缺失版本为 unknown，不以配置或历史值填充。

CLI 回归使用本地验证提交 `2d0a0775a`，在上述实现上合入 #1143 的安全清理提交 `72c9bfb120c667e5c7855c31db4d0f2c209c374c`，重建 dist 后执行 `pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/issue-1074-doctor.test.ts`，3 项全部通过：静态只读、显式构建、宿主不可达时保留各层失败事实和脱敏输出。验证分支未推入本 PR，未启动 IDE，也不把 CLI 结果作为真实宿主通过证据。

## 最新稳定版实测与版本回归

2026-10-01 00:20 UTC 重新核对官方配置，稳定版为 `2.02.2608080`，实际宿主一致。机器解锁且全机无其他 E2E/watch 后，安全验证提交 `2d0a0775a` 重建 dist，真实 `issue-1074-doctor.runtime.test.ts` 通过 1 个用例、3 个 DOM 检查点，包括事件、自定义方法、独立分包导航及实际 Doctor 查询。直接消费构建后的 `queryWechatIdeLogin` 返回 `success/login=true`；完整分层 CLI 对已打开的测试项目读取 10 个阶段事实全部 passed，退出码 0，实际基础库 `3.17.2`。

完整报告同时暴露框架版本误用了供编译期替换的 `VERSION` 常量，输出 `__VERSION__`。最小回归 1 失败、11 通过；改用发行包的 `package.json` 元数据，与已有 CLI 版本展示保持一致。相关 24 项测试、类型检查、构建、定向 ESLint 通过，构建后的 CLI suite 再次 3/3 通过。真实分层 CLI 复验 10 个阶段通过，框架版本与当前包元数据相符，不包含占位符或本机路径。该修复在安全验证分支验证后单独 cherry-pick 回本 PR，未引入 #1143 的修改。

宿主阶段实测基于上述验证分支；版本修复的 CLI 复验基于同一分支提交前工作树，不冒充独立 PR HEAD 的整套实测。最后 Computer Use 再查时 Mac 又锁定，尚缺最终 UI 状态保留检查，保持该限制；没有关闭共享宿主或清理全局记录。原始版本占位符报告及修复后报告均保留。
